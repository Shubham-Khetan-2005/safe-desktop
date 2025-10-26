#!/bin/bash

# TPM Signing Agent Setup and Server Script
# This script sets up TPM keys and runs the signing server

set -e  # Exit on any error

# Configuration
DEFAULT_PORT="8080"
KEY_DIR="./keys"
SERVER_BINARY="./tpm-signing-server"
KEY_GENERATOR_BINARY="./key-generator"
LOG_FILE="./tmp-server.log"
HANDLE_START=$((0x81010002))

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ✗${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install TPM tools on different systems
install_tpm_tools() {
    log "Installing TPM tools..."
    
    if command_exists apt-get; then
        # Ubuntu/Debian
        log "Detected Debian/Ubuntu system"
        sudo apt-get update
        sudo apt-get install -y tpm2-tools libtss2-dev
    elif command_exists yum; then
        # Red Hat/CentOS
        log "Detected Red Hat/CentOS system"
        sudo yum install -y tpm2-tools tpm2-tss-devel
    elif command_exists dnf; then
        # Fedora
        log "Detected Fedora system"
        sudo dnf install -y tpm2-tools tpm2-tss-devel
    elif command_exists pacman; then
        # Arch Linux
        log "Detected Arch Linux system"
        sudo pacman -S --noconfirm tpm2-tools tpm2-tss
    elif command_exists brew; then
        # macOS
        log "Detected macOS system"
        brew install tpm2-tools
    else
        log_error "Unsupported system. Please install tpm2-tools manually."
        exit 1
    fi
    
    log_success "TPM tools installed successfully"
}

# Function to check TPM availability
check_tpm() {
    log "Checking TPM availability..."
    
    if [ -c "/dev/tpm0" ] || [ -c "/dev/tpmrm0" ]; then
        log_success "TPM device found"
        return 0
    elif command_exists tpm2_startup; then
        # Try to startup TPM (might be a simulator)
        if tpm2_startup -c 2>/dev/null; then
            log_success "TPM simulator available"
            return 0
        fi
    fi
    
    log_error "No TPM device found. This application requires TPM 2.0 hardware or simulator."
    log "Please ensure:"
    log "  1. TPM 2.0 is enabled in BIOS/UEFI"
    log "  2. TPM modules are loaded: sudo modprobe tpm_tis"
    log "  3. Or install TPM simulator: sudo apt-get install swtpm swtpm-tools"
    exit 1
}

# Function to find next available TPM handle
find_next_handle() {
    local start_handle=$1
    local current_handle=$start_handle
    local max_handle=$((0x81010100))  # Convert hex to decimal for comparison
    
    log "Finding next available TPM persistent handle..." >&2
    
    while [ $current_handle -lt $max_handle ]; do
        # Check if handle is in use
        local handle_hex=$(printf "0x%08X" $current_handle)
        if ! sudo tpm2_readpublic -c $handle_hex >/dev/null 2>&1; then
            log_success "Found available handle: $handle_hex" >&2
            echo $current_handle
            return 0
        fi
        current_handle=$((current_handle + 1))
    done
    
    log_error "No available TPM persistent handles found" >&2
    exit 1
}

# Function to build binaries
build_binaries() {
    log "Building server binaries..."
    
    # Build key generator
    if [ -d "create_key" ]; then
        log "Building key generator..."
        cd create_key
        go build -o "../${KEY_GENERATOR_BINARY}" main.go
        cd ..
        log_success "Key generator built: ${KEY_GENERATOR_BINARY}"
    else
        log_error "create_key directory not found"
        exit 1
    fi
    
    # Build server (prefer unseal_server over signer)
    if [ -d "unseal_server" ]; then
        log "Building unseal server..."
        cd unseal_server
        go build -o "../${SERVER_BINARY}" main.go
        cd ..
        log_success "Server built: ${SERVER_BINARY}"
    elif [ -d "signer" ]; then
        log "Building signer server..."
        cd signer
        go build -o "../${SERVER_BINARY}" main.go
        cd ..
        log_success "Server built: ${SERVER_BINARY}"
    else
        log_error "No server directory found"
        exit 1
    fi
}

# Function to generate and seal private key
setup_tpm_key() {
    local handle=$1
    local handle_hex=$(printf "0x%08X" $handle)
    
    log "Setting up TPM key with handle $handle_hex..."
    
    # Create keys directory
    mkdir -p "$KEY_DIR"
    cd "$KEY_DIR"
    
    # Generate private key
    log "Generating secp256k1 private key..."
    if ! ../${KEY_GENERATOR_BINARY} >/dev/null 2>&1; then
        log_error "Failed to generate private key"
        exit 1
    fi
    
    if [ ! -f "secp256k1.priv" ]; then
        log_error "Private key file not generated"
        exit 1
    fi
    
    log_success "Private key generated: secp256k1.priv"
    
    # Create TPM primary key
    log "Creating TPM primary key..."
    if ! sudo tpm2_createprimary -C o -g sha256 -G rsa -c primary.ctx >/dev/null 2>&1; then
        log_error "Failed to create TPM primary key"
        exit 1
    fi
    log_success "TPM primary key created"
    
    # Seal the private key
    log "Sealing private key to TPM..."
    if ! sudo tpm2_create -C primary.ctx -i secp256k1.priv -r sealed.priv -u sealed.pub -c sealed.ctx -a "fixedtpm|fixedparent|userwithauth" >/dev/null 2>&1; then
        log_error "Failed to seal private key"
        exit 1
    fi
    log_success "Private key sealed to TPM"
    
    # Load the sealed key
    log "Loading sealed key..."
    if ! sudo tpm2_load -C primary.ctx -u sealed.pub -r sealed.priv -c sealed.load.ctx >/dev/null 2>&1; then
        log_error "Failed to load sealed key"
        exit 1
    fi
    log_success "Sealed key loaded"
    
    # Make persistent
    log "Making key persistent at handle $handle_hex..."
    if ! sudo tpm2_evictcontrol -c sealed.load.ctx $handle_hex >/dev/null 2>&1; then
        log_error "Failed to make key persistent"
        exit 1
    fi
    log_success "Key made persistent at handle $handle_hex"
    
    cd ..
    
    # Save handle to config file
    echo "TPM_HANDLE=$handle_hex" > .tpm-config
    log_success "TPM setup completed successfully"
}

# Function to start the server
start_server() {
    local port=${1:-$DEFAULT_PORT}
    local handle
    
    # Read handle from config file
    if [ -f ".tpm-config" ]; then
        source .tpm-config
        handle=$TPM_HANDLE
        log "Using stored TPM handle: $handle"
    else
        log_error "No TPM configuration found. Please run setup first."
        exit 1
    fi
    
    log "Starting TPM signing server on port $port..."
    log "Server binary: $SERVER_BINARY"
    log "TPM handle: $handle"
    log "Log file: $LOG_FILE"
    
    # Check if server binary exists
    if [ ! -f "$SERVER_BINARY" ]; then
        log_error "Server binary not found: $SERVER_BINARY"
        log "Please run with --build flag first"
        exit 1
    fi
    
    # Kill any existing server on the same port
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "Port $port is already in use. Killing existing process..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
    
    # Start the server
    log "Starting server..."
    if [ -d "unseal_server" ]; then
        # Use unseal server
        sudo ./${SERVER_BINARY} -tpm-handle "$handle" -port "$port" > "$LOG_FILE" 2>&1 &
    else
        # Use signer server
        sudo ./${SERVER_BINARY} -handle "$handle" -port "$port" > "$LOG_FILE" 2>&1 &
    fi
    
    local server_pid=$!
    echo $server_pid > .server-pid
    
    # Wait a moment and check if server started successfully
    sleep 3
    
    if kill -0 $server_pid 2>/dev/null; then
        log_success "Server started successfully (PID: $server_pid)"
        log "Server running on: http://localhost:$port"
        log "Endpoints available:"
        log "  GET  /address - Get Ethereum address"
        log "  POST /sign    - Sign transaction hash"
        log "Log file: $LOG_FILE"
        
        # Test the server
        if command_exists curl; then
            log "Testing server endpoints..."
            sleep 2
            
            if address=$(curl -s "http://localhost:$port/address" | grep -o '"address":"[^"]*"' | cut -d'"' -f4 2>/dev/null); then
                log_success "Server test passed. Address: $address"
            else
                log_warning "Server started but endpoint test failed"
            fi
        fi
        
        echo
        log "🚀 TPM Signing Server is running!"
        log "   Address endpoint: curl http://localhost:$port/address"
        log "   Sign endpoint:    curl -X POST http://localhost:$port/sign -H 'Content-Type: application/json' -d '{\"txHashHex\":\"0x...\"}'"
        log "   Stop server:      ./setup-and-run.sh --stop"
        echo
        
    else
        log_error "Server failed to start"
        if [ -f "$LOG_FILE" ]; then
            log "Server log:"
            tail -n 10 "$LOG_FILE"
        fi
        exit 1
    fi
}

# Function to stop the server
stop_server() {
    log "Stopping TPM signing server..."
    
    if [ -f ".server-pid" ]; then
        local pid=$(cat .server-pid)
        if kill -0 $pid 2>/dev/null; then
            sudo kill $pid
            log_success "Server stopped (PID: $pid)"
        else
            log_warning "Server process not found"
        fi
        rm -f .server-pid
    else
        log_warning "No server PID file found"
    fi
    
    # Also kill any processes on the default port
    if lsof -Pi :$DEFAULT_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        lsof -ti:$DEFAULT_PORT | xargs sudo kill -9 2>/dev/null || true
        log "Killed processes on port $DEFAULT_PORT"
    fi
}

# Function to show status
show_status() {
    log "TPM Signing Server Status"
    echo
    
    # Check TPM
    if check_tpm >/dev/null 2>&1; then
        log_success "TPM: Available"
    else
        log_error "TPM: Not available"
    fi
    
    # Check configuration
    if [ -f ".tpm-config" ]; then
        source .tpm-config
        log_success "Configuration: Found (Handle: $TPM_HANDLE)"
    else
        log_warning "Configuration: Not found"
    fi
    
    # Check binaries
    if [ -f "$SERVER_BINARY" ]; then
        log_success "Server binary: Found"
    else
        log_warning "Server binary: Not found"
    fi
    
    if [ -f "$KEY_GENERATOR_BINARY" ]; then
        log_success "Key generator: Found"
    else
        log_warning "Key generator: Not found"
    fi
    
    # Check server process
    if [ -f ".server-pid" ]; then
        local pid=$(cat .server-pid)
        if kill -0 $pid 2>/dev/null; then
            log_success "Server: Running (PID: $pid)"
            if command_exists curl && curl -s "http://localhost:$DEFAULT_PORT/address" >/dev/null 2>&1; then
                log_success "Server: Responding to requests"
            else
                log_warning "Server: Not responding to requests"
            fi
        else
            log_warning "Server: Not running"
            rm -f .server-pid
        fi
    else
        log_warning "Server: Not running"
    fi
}

# Function to clean up everything
clean_all() {
    log "Cleaning up TPM signing agent..."
    
    # Stop server
    stop_server
    
    # Remove binaries
    rm -f "$SERVER_BINARY" "$KEY_GENERATOR_BINARY"
    
    # Remove configuration
    rm -f .tpm-config .server-pid
    
    # Remove logs
    rm -f "$LOG_FILE"
    
    # Clean up keys (optional - ask user)
    if [ -d "$KEY_DIR" ]; then
        echo
        read -p "Remove generated keys and TPM data? [y/N]: " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Remove TPM persistent handle if we know it
            if [ -f ".tpm-config" ]; then
                source .tpm-config
                log "Removing TPM persistent handle: $TPM_HANDLE"
                sudo tpm2_evictcontrol -c "$TPM_HANDLE" 2>/dev/null || true
            fi
            
            rm -rf "$KEY_DIR"
            log_success "Keys and TPM data removed"
        else
            log "Keys preserved"
        fi
    fi
    
    log_success "Cleanup completed"
}

# Main script logic
main() {
    local command=""
    local port="$DEFAULT_PORT"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --install-deps)
                command="install_deps"
                shift
                ;;
            --build)
                command="build"
                shift
                ;;
            --setup)
                command="setup"
                shift
                ;;
            --start|--run)
                command="start"
                shift
                ;;
            --stop)
                command="stop"
                shift
                ;;
            --status)
                command="status"
                shift
                ;;
            --clean)
                command="clean"
                shift
                ;;
            --port)
                port="$2"
                shift 2
                ;;
            --help|-h)
                echo "TPM Signing Agent Setup and Server Script"
                echo
                echo "Usage: $0 [COMMAND] [OPTIONS]"
                echo
                echo "Commands:"
                echo "  --install-deps    Install TPM tools and dependencies"
                echo "  --build          Build server binaries"
                echo "  --setup          Generate keys and setup TPM"
                echo "  --start, --run   Start the signing server"
                echo "  --stop           Stop the signing server"
                echo "  --status         Show system status"
                echo "  --clean          Clean up all files and TPM data"
                echo "  --help, -h       Show this help message"
                echo
                echo "Options:"
                echo "  --port PORT      Server port (default: $DEFAULT_PORT)"
                echo
                echo "Examples:"
                echo "  $0 --install-deps --build --setup --start"
                echo "  $0 --start --port 8080"
                echo "  $0 --status"
                echo "  $0 --stop"
                exit 0
                ;;
            *)
                log_error "Unknown argument: $1"
                log "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Default behavior: full setup and start
    if [ -z "$command" ]; then
        log "Starting full TPM signing agent setup..."
        echo
        
        # Check if tools are installed
        if ! command_exists tpm2_startup; then
            install_tpm_tools
        fi
        
        # Check TPM
        check_tpm
        
        # Build if needed
        if [ ! -f "$SERVER_BINARY" ] || [ ! -f "$KEY_GENERATOR_BINARY" ]; then
            build_binaries
        fi
        
        # Setup if needed
        if [ ! -f ".tpm-config" ]; then
            local handle=$(find_next_handle $HANDLE_START)
            setup_tpm_key $handle
        fi
        
        # Start server
        start_server "$port"
        
    else
        # Execute specific command
        case $command in
            install_deps)
                install_tpm_tools
                ;;
            build)
                build_binaries
                ;;
            setup)
                check_tpm
                local handle=$(find_next_handle $HANDLE_START)
                setup_tpm_key $handle
                ;;
            start)
                start_server "$port"
                ;;
            stop)
                stop_server
                ;;
            status)
                show_status
                ;;
            clean)
                clean_all
                ;;
        esac
    fi
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "🔐 TPM Signing Agent Setup Script"
    echo "================================="
    echo
    
    # Check if running as root for some operations
    if [[ $EUID -eq 0 ]] && [[ "$1" != "--help" ]] && [[ "$1" != "-h" ]] && [[ "$1" != "--status" ]]; then
        log_warning "Running as root. This script will use sudo when needed."
    fi
    
    main "$@"
fi
