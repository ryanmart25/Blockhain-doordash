// MealDispatch - Main Application JavaScript
// This file handles initialization, Web3/IPFS connections, and core application logic

// ==================== GLOBAL VARIABLES ====================

// Web3 instance for blockchain interaction
let web3;

// Smart contract instance
let contract;

// IPFS client instance for decentralized file storage
let ipfs;

// Array of available Ethereum accounts from Ganache
let accounts = [];

// Currently selected Ethereum account
let currentAccount = null;

// Shopping cart: stores items customer wants to order
let cart = [];

// Temporary storage for menu items during store creation/editing
let tempMenuItems = [];

// Address of the currently selected store
let selectedStoreAddress = null;

// Complete data of the currently selected store (from IPFS)
let selectedStoreData = null;

// Order processing fee constant (0.002 ETH charged by platform)
const ORDER_PROCESSING_FEE = 0.002;

// Delivery fee constant (0.01 ETH paid to driver)
const DELIVERY_FEE = 0.01;

// IPFS Registry - stores all Content Identifiers (CIDs) locally in browser localStorage
let ipfsRegistry = {
  stores: [], 
  drivers: [], 
  customers: [],
};

// Track which accounts are in use during current session
let usedAccounts = new Set();


let contractABI = null;  

// to fix load ABI issue. this makes sure ABI is loaded.
async function ensureABI() {
  if (contractABI) return contractABI;

  const artifactPath = "./build/contracts/MealDispatchDApp.json";
  try {
    const res = await fetch(artifactPath);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${artifactPath}`);
    const artifact = await res.json();
    const abi = artifact.abi ?? artifact;
    if (!Array.isArray(abi)) throw new Error("ABI missing or malformed");
    contractABI = abi;
    log("Loaded ABI from artifact JSON", "success");
    return contractABI;
  } catch (err) {
    throw new Error(
      `Unable to load ABI. ${err.message}. ` 
    );
  }
}


// Corresponds to OrderState enum in smart contract: Placed(0), Accepted(1), ReadyForPickup(2), OnDelivery(3), Delivered(4), Completed(5), Canceled(6)
const statusNames = [
  "Placed",
  "Accepted (Preparing)",
  "Ready for Delivery",
  "On Delivery",
  "Delivered",
  "Completed",
  "Cancelled",
];

// ==================== INITIALIZATION & PERSISTENCE FIXES ====================

/**
 * Load IPFS Registry from localStorage
 * The registry stores all CIDs (Content Identifiers) for stores, drivers, and customers
 * This allows the UI to fetch data from IPFS without needing a separate database
 */
function loadIPFSRegistry() {
  const saved = localStorage.getItem("mealDispatchIPFS");
  if (saved) {
    try {
      ipfsRegistry = JSON.parse(saved);
      log(
        `Loaded registry: ${ipfsRegistry.stores.length} stores, ${ipfsRegistry.drivers.length} drivers, ${ipfsRegistry.customers.length} customers`
      );
    } catch (e) {
      log(`Error loading registry: ${e.message}`, "error");
      ipfsRegistry = { stores: [], drivers: [], customers: [] };
    }
  }
}

/**
 * Save IPFS Registry to localStorage
 * Persists the registry so it survives page refreshes
 */
function saveIPFSRegistry() {
  try {
    localStorage.setItem("mealDispatchIPFS", JSON.stringify(ipfsRegistry));
    log(`Registry saved`);
  } catch (e) {
    log(`Error saving registry: ${e.message}`, "error");
  }
}


/*
 * Attempts to restore Web3, Contract, and IPFS connections using data saved in localStorage.
 * This ensures state persists across page loads 
 */
async function restoreConnections() {
    log("Attempting to restore connections from localStorage...");
    
    const isConnected = localStorage.getItem('web3_connected') === 'true';
    const contractAddress = localStorage.getItem('contract_address');
    const providerUrl = localStorage.getItem('web3_provider_url');
    const accountsString = localStorage.getItem('ganache_accounts');
    const abiString = localStorage.getItem('contract_abi');
    
    if (!isConnected || !contractAddress || !providerUrl || !accountsString || !abiString) {
        return false;
    }

    try {
        // 1. Restore Web3
        web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));
        accounts = JSON.parse(accountsString);
        currentAccount = accounts[0];
        log(`✅ Web3 restored with ${accounts.length} accounts.`, "success");

        // 2. Restore Contract ABI and Instance
        contractABI = JSON.parse(abiString);
        contract = new web3.eth.Contract(contractABI, contractAddress);
        const orderCount = await contract.methods.orderCounter().call();
        log(`✅ Contract restored at ${contractAddress.substring(0, 10)}... with ${orderCount} orders.`, "success");

        // 3. Restore IPFS client (using default host/port)
        ipfs = window.IpfsHttpClient.create({
            host: "127.0.0.1",
            port: 5001,
            protocol: "http",
        });

        await displayAccounts();
        await populateAllDropdowns();

        showStatus("connectionStatus", "✅ RESTORED FROM LOCAL STORAGE!", "success");
        log("\n✅ READY TO USE (Restored)!\n", "success");
        return true; 

    } catch (error) {
        log(`❌ FAILED to restore connections: ${error.message}`, "error");
        showStatus("connectionStatus", `❌ Failed to restore: ${error.message}`, "error");
        localStorage.removeItem('web3_connected');
        return false;
    }
}


// ==================== LOGGING & CONNECTIONS ====================

/**
 * Log messages to console with timestamp and visual formatting
 * @param {string} message 
 * @param {string} type 
 */
function log(message, type = "info") {
  const errorConsole = document.getElementById("errorConsole");
  if (errorConsole) {
    errorConsole.classList.remove("hidden");
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === "error" ? "❌" : type === "success" ? "✅" : "ℹ️";
    errorConsole.textContent += `[${timestamp}] ${prefix} ${message}\n`;
    errorConsole.scrollTop = errorConsole.scrollHeight;
  }
  console.log(`[${type}] ${message}`);
}

/**
 * Test all connections before initializing
 * Tests Ganache RPC, IPFS daemon, and smart contract deployment
 */
async function testConnections() {
  const errorConsole = document.getElementById("errorConsole");
  if (errorConsole) {
    errorConsole.textContent = "";
    errorConsole.classList.remove("hidden");
  }

  log("======================================");
  log("STARTING CONNECTION TESTS");
  log("======================================\n");

  // TEST 1: Test Ganache connection
  log("🔍 TEST 1: Testing Ganache...");
  try {
    const rpcUrlInput = document.getElementById("rpcUrl");
    if (!rpcUrlInput) throw new Error("RPC URL input not found");
    const rpcUrl = rpcUrlInput.value;
    log(`  RPC URL: ${rpcUrl}`);

    // Create temporary Web3 instance for testing
    const testWeb3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
    const networkId = await testWeb3.eth.net.getId();
    log(`  ✅ Connected! Network ID: ${networkId}`, "success");

    // Check if accounts are available
    const testAccounts = await testWeb3.eth.getAccounts();
    log(`  ✅ Found ${testAccounts.length} accounts`, "success");
  } catch (e) {
    log(`  ❌ FAILED: ${e.message}`, "error");
    return;
  }

  // TEST 2: Test IPFS connection
  log("\n🔍 TEST 2: Testing IPFS...");
  try {
    const ipfsUrlInput = document.getElementById("ipfsUrl");
    if (!ipfsUrlInput) throw new Error("IPFS URL input not found");
    const ipfsUrl = ipfsUrlInput.value;
    // Test IPFS by calling id endpoint which is more reliable
    const response = await fetch(`${ipfsUrl}/api/v0/id`, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      log(`IPFS Ready! ID: ${data.ID.substring(0, 20)}...`, "success");
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (e) {
    // Try alternative check
    try {
      const ipfsUrlInput = document.getElementById("ipfsUrl");
      if (ipfsUrlInput) {
        const testIpfs = window.IpfsHttpClient.create({
          host: "127.0.0.1",
          port: 5001,
          protocol: "http",
        });
        const version = await testIpfs.version();
        log(`IPFS Ready! Version: ${version.version}`, "success");
      }
    } catch (e2) {
      log(`IPFS check inconclusive (may still work)`, "info");
    }
  }

  // TEST 3: Test Smart Contract deployment
  log("\nTEST 3: Testing Contract...");
  const contractAddrInput = document.getElementById("contractAddress");

  if (!contractAddrInput || !contractAddrInput.value) {
    log(`No contract address`, "error");
  } else {
    try {
      const contractAddr = contractAddrInput.value;
      const rpcUrlInput = document.getElementById("rpcUrl");
      const testWeb3 = new Web3(
        new Web3.providers.HttpProvider(rpcUrlInput.value)
      );
      // Get bytecode at the contract address
      const code = await testWeb3.eth.getCode(contractAddr);

      // Check if contract exists (bytecode should not be empty)
      if (code === "0x" || code === "0x0") {
        log(`No contract at address`, "error");
      } else {
        log(`  ✅ Contract Found!`, "success");
      }
    } catch (e) {
      log(`Error: ${e.message}`, "error");
    }
  }

  log("\n======================================");
  log("TESTS COMPLETE");
  log("======================================");
}

/**
 * Initialize all connections (Web3, IPFS, Smart Contract)
 * This function must be called before using the application
 */
async function initializeConnections() {
  try {
    log("\nINITIALIZING...");

    // Get connection parameters from input fields
    const rpcUrlInput = document.getElementById("rpcUrl");
    const ipfsUrlInput = document.getElementById("ipfsUrl");
    const contractAddrInput = document.getElementById("contractAddress");

    if (!rpcUrlInput || !ipfsUrlInput || !contractAddrInput) {
      throw new Error("Connection inputs not found");
    }

    const rpcUrl = rpcUrlInput.value;
    const ipfsUrl = ipfsUrlInput.value;
    const contractAddr = contractAddrInput.value;

    // Validate contract address is provided
    if (!contractAddr) throw new Error("Enter contract address");

    // Initialize Web3 with Ganache provider
    log("Connecting to Ganache...");
    web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
    accounts = await web3.eth.getAccounts();
    currentAccount = accounts[0];
    log(`✅ Web3: ${accounts.length} accounts`, "success");

    
   //Ensure ABI is loaded BEFORE contract usage 
    await ensureABI();

    // Initialize Smart Contract instance
    log("Loading contract...");
    contract = new web3.eth.Contract(contractABI, contractAddr);

    // Test contract by reading orderCounter
    const orderCount = await contract.methods.orderCounter().call();
    log(`✅ Contract: ${orderCount} orders`, "success");

    // Initialize IPFS client
    log("Connecting to IPFS...");
    ipfs = window.IpfsHttpClient.create({
      host: "127.0.0.1",
      port: 5001,
      protocol: "http",
    });
    
    ipfs.apiUrl = ipfsUrl;
    const version = await ipfs.version();
    log(`✅ IPFS: v${version.version}`, "success");

    // Load saved IPFS registry from localStorage
    loadIPFSRegistry();

    log("Saving connection data for persistence...");
    // Save state flag
    localStorage.setItem('web3_connected', 'true');
    // Save connection details
    localStorage.setItem('contract_address', contractAddr);
    localStorage.setItem('web3_provider_url', rpcUrl);
    // Save critical data
    localStorage.setItem('ganache_accounts', JSON.stringify(accounts));
    localStorage.setItem('contract_abi', JSON.stringify(contractABI));
    saveIPFSRegistry(); // This function saves the global ipfsRegistry
    log("✅ Data saved successfully.", "success");

    // Display Ganache accounts with balances
    await displayAccounts();

    // Populate all dropdown menus with data
    await populateAllDropdowns();

    // Show success message
    showStatus("connectionStatus", "✅ ALL CONNECTED!", "success");
    log("\n✅ READY TO USE!\n", "success");
  } catch (error) {
    log(`\n❌ FAILED: ${error.message}`, "error");
    showStatus("connectionStatus", `❌ Failed: ${error.message}`, "error");
  }
}

/**
 * Display all Ganache accounts with their balances
 */
async function displayAccounts() {
  const list = document.getElementById("accountsList");
  if (!list) return; // Guard clause if element doesn't exist

  let html = "";

  // Iterate through all accounts and get their ETH balance
  for (let i = 0; i < accounts.length; i++) {
    const balance = await web3.eth.getBalance(accounts[i]);
    const balanceEth = web3.utils.fromWei(balance, "ether");
    html += `<div class="order-card">
            <strong>Account ${i}:</strong> ${accounts[i]}<br>
            <small>Balance: ${parseFloat(balanceEth).toFixed(4)} ETH</small>
        </div>`;
  }
  list.innerHTML = html;
}

/**
 * Populate all dropdown menus in the application
 * Called after successful connection initialization
 */
async function populateAllDropdowns() {
  await rebuildAddressMaps();

  populateAccountDropdowns();

  // Populate all entity-specific dropdowns
  populateExistingStoresDropdown();
  populateExistingDriversDropdown();
  populateExistingCustomersDropdown();
  populateRegisterStoreDropdown();
  populateRegisterDriverDropdown();
  populateCustomerNamesDropdown();
  await populateDriverNamesDropdown();
  await populateStoreManageDropdown();
}

/**
 * Rebuild address maps by checking blockchain registrations
 * and matching with IPFS registry
 */
async function rebuildAddressMaps() {
  for (const account of accounts) {
    try {
      // Check stores
      const isStore = await contract.methods.isStoreRegistered(account).call();
      if (isStore && !storeAddressMap[account]) {
        // Try to match with first available store in registry
        for (const store of ipfsRegistry.stores) {
          if (!Object.values(storeAddressMap).includes(store.cid)) {
            storeAddressMap[account] = store.cid;
            break;
          }
        }
      }

      // Check drivers
      const isDriver = await contract.methods
        .isDriverRegistered(account)
        .call();
      if (isDriver && !driverAddressMap[account]) {
        // Try to match with first available driver in registry
        for (const driver of ipfsRegistry.drivers) {
          if (!Object.values(driverAddressMap).includes(driver.cid)) {
            driverAddressMap[account] = driver.cid;
            break;
          }
        }
      }
    } catch (e) {
      continue;
    }
  }
}

/**
 * Populate account dropdowns with available (unused) accounts
 */
function populateAccountDropdowns() {
  // Mark account[0] as owner and always used
  if (accounts.length > 0) {
    usedAccounts.add(accounts[0]);
  }

  const dropdowns = [
    "registerStoreAccount",
    "registerDriverAccount",
    "customerAccountSelect",
  ];
  dropdowns.forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '<option value="">Select Account</option>';
    accounts.forEach((account, index) => {
      // Skip account[0] (owner) and already used accounts
      if (index > 0 && !usedAccounts.has(account)) {
        const option = document.createElement("option");
        option.value = account;
        option.textContent = `Account ${index}: ${account.substring(
          0,
          10
        )}...${account.substring(account.length - 8)}`;
        select.appendChild(option);
      }
    });
  });

  // Populate owner account dropdown (only account[0])
  const ownerSelect = document.getElementById("ownerAccountSelect");
  if (ownerSelect && accounts.length > 0) {
    ownerSelect.innerHTML = "";
    const option = document.createElement("option");
    option.value = accounts[0];
    option.textContent = `Account 0 (Owner): ${accounts[0].substring(
      0,
      10
    )}...${accounts[0].substring(accounts[0].length - 8)}`;
    option.selected = true;
    ownerSelect.appendChild(option);
  }
}

// ==================== UI HELPER FUNCTIONS ====================

/**
 * Switch between tabs in the application
 * @param {Event} evt 
 * @param {string} tabName - 
 */
function openTab(evt, tabName) {
  // Hide all tab contents
  const contents = document.getElementsByClassName("tab-content");
  for (let content of contents) {
    content.classList.remove("active");
  }

  // Remove active class from all tab buttons
  const tabs = document.getElementsByClassName("tab");
  for (let tab of tabs) {
    tab.classList.remove("active");
  }

  // Show selected tab content and mark button as active
  document.getElementById(tabName).classList.add("active");
  evt.currentTarget.classList.add("active");
}

/**
 * Display status message to user
 * @param {string} elementId
 * @param {string} message
 * @param {string} type 
 */
function showStatus(elementId, message, type) {
  const element = document.getElementById(elementId);
  element.innerHTML = `<div class="status ${type}">${message}</div>`;
}

/**
 * Preview image before uploading to IPFS
 * @param {string} inputId 
 * @param {string} previewId 
 */
function previewImage(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);

  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      preview.src = e.target.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// ==================== IPFS FUNCTIONS ====================

/**
 * Upload a file (image) to IPFS
 * @param {File} file
 * @returns {Promise<string>}
 */
async function uploadFileToIPFS(file) {
  try {
    const result = await ipfs.add(file);
    return result.path;
  } catch (error) {
    throw new Error(`IPFS file upload failed: ${error.message}`);
  }
}

/**
 * Upload JSON data to IPFS
 * @param {Object} data
 * @returns {Promise<string>} 
 */
async function uploadJSONToIPFS(data) {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    const result = await ipfs.add(jsonString);
    return result.path;
  } catch (error) {
    throw new Error(`IPFS JSON upload failed: ${error.message}`);
  }
}

/**
 * Retrieve JSON data from IPFS using CID
 * @param {string} cid 
 * @returns {Promise<Object>}
 */
async function getFromIPFS(cid) {
  try {
    const chunks = [];
    for await (const chunk of ipfs.cat(cid)) {
      chunks.push(chunk);
    }
    // Combine chunks into single Uint8Array
    const data = new Uint8Array(
      chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    );
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.length;
    }
    // Decode and parse JSON
    const text = new TextDecoder().decode(data);
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`IPFS retrieval failed: ${error.message}`);
  }
}

/**
 * Generate URL to access IPFS image via HTTP gateway
 * @param {string} cid
 * @returns {string}
 */
function getIPFSImageURL(cid) {
  if (!cid) return "";
  return `${ipfs.apiUrl}/ipfs/${cid}`;
}

// ==================== INITIALIZATION ON PAGE LOAD ====================

/**
 * Initialize application when page loads
 * Sets up event listeners and loads saved registry
 */
window.addEventListener("load", async () => { 
  log("MealDispatch loaded");
  loadIPFSRegistry();


  const restored = await restoreConnections();
  if (!restored) {
    log('Click "INITIALIZE" to connect to Ganache and IPFS');
  }

});