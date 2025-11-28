// this code was given to me by harry, so that's why it is suddenly copy and pasted.

// MealDispatch - Functions JavaScript File
// This file contains all UI interaction functions for stores, drivers, customers, and order management
// Adapted to work with MealDispatchDApp.sol smart contract

// ==================== STORE DROPDOWN FUNCTIONS ====================

/**
 * Populate dropdown with existing stores from IPFS registry
 * Used in "Add Stores" tab to allow editing of existing stores
 */
function populateExistingStoresDropdown() {
  const select = document.getElementById("existingStoreSelect");
  if (!select) return;
  select.innerHTML = '<option value="">-- Create New Store --</option>';

  // Add each store from registry to dropdown
  ipfsRegistry.stores.forEach((store, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = store.name;
    select.appendChild(option);
  });
}

/**
 * Populate dropdown for store registration
 * Shows which stores are already registered on blockchain
 */
function populateRegisterStoreDropdown() {
  const select = document.getElementById("registerStoreSelect");
  if (!select) return;
  select.innerHTML = '<option value="">-- Select a Store --</option>';

  ipfsRegistry.stores.forEach((store, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = store.name;
    select.appendChild(option);
  });
}

// ==================== LOAD EXISTING STORE ====================

/**
 * Load an existing store's data from IPFS when selected from dropdown
 * Populates all form fields with the store's current data for editing
 */
async function loadExistingStore() {
  const select = document.getElementById("existingStoreSelect");
  if (!select) return;
  const index = select.value;

  // If "Create New Store" is selected, clear all fields
  if (index === "") {
    if (document.getElementById("addStoreName"))
      document.getElementById("addStoreName").value = "";
    if (document.getElementById("addStoreDescription"))
      document.getElementById("addStoreDescription").value = "";
    if (document.getElementById("addStoreStreetAddress"))
      document.getElementById("addStoreStreetAddress").value = "";
    if (document.getElementById("menuItemsContainer"))
      document.getElementById("menuItemsContainer").innerHTML = "";
    if (document.getElementById("storeLogoPreview"))
      document.getElementById("storeLogoPreview").style.display = "none";
    if (document.getElementById("storePicturePreview"))
      document.getElementById("storePicturePreview").style.display = "none";
    if (document.getElementById("addStoreLogo"))
      document.getElementById("addStoreLogo").value = "";
    if (document.getElementById("addStorePicture"))
      document.getElementById("addStorePicture").value = "";
    tempMenuItems = [];
    return;
  }

  try {
    // Fetch store data from IPFS
    const store = ipfsRegistry.stores[index];
    const storeData = await getFromIPFS(store.cid);

    // Populate form fields with store data
    if (document.getElementById("addStoreName"))
      document.getElementById("addStoreName").value = storeData.name;
    if (document.getElementById("addStoreDescription"))
      document.getElementById("addStoreDescription").value =
        storeData.description;
    if (document.getElementById("addStoreStreetAddress"))
      document.getElementById("addStoreStreetAddress").value =
        storeData.streetAddress || "";

    // Display logo if exists
    if (storeData.logoCID && document.getElementById("storeLogoPreview")) {
      document.getElementById("storeLogoPreview").src = getIPFSImageURL(
        storeData.logoCID
      );
      document.getElementById("storeLogoPreview").style.display = "block";
    }

    // Display picture if exists
    if (
      storeData.pictureCID &&
      document.getElementById("storePicturePreview")
    ) {
      document.getElementById("storePicturePreview").src = getIPFSImageURL(
        storeData.pictureCID
      );
      document.getElementById("storePicturePreview").style.display = "block";
    }

    // Load menu items
    tempMenuItems = storeData.menu || [];
    displayTempMenu();
  } catch (error) {
    alert("Error loading store: " + error.message);
  }
}

// ==================== MENU ITEM FUNCTIONS ====================

/**
 * Add a menu item form to the page
 * @param {Object} itemData - Optional pre-existing menu item data for editing
 */
// Global variable to track which store CID is associated with which address
let storeAddressMap = {}; // address -> cid
let driverAddressMap = {}; // address -> cid
function addMenuItem(itemData = null) {
  const container = document.getElementById("menuItemsContainer");
  if (!container) return;

  const itemDiv = document.createElement("div");
  itemDiv.className = "menu-item";

  const itemIndex = tempMenuItems.length;

  // Create HTML for menu item form
  itemDiv.innerHTML = `
        <h4>Menu Item ${itemIndex + 1}</h4>
        <div class="form-group">
            <label>Item Name:</label>
            <input type="text" class="menuItemName" data-index="${itemIndex}" value="${
    itemData ? itemData.name : ""
  }" placeholder="e.g., Pizza">
        </div>
        <div class="form-group">
            <label>Description:</label>
            <textarea class="menuItemDescription" data-index="${itemIndex}" rows="2">${
    itemData ? itemData.description : ""
  }</textarea>
        </div>
        <div class="form-group">
            <label>Price (ETH):</label>
            <input type="number" class="menuItemPrice" data-index="${itemIndex}" step="0.001" value="${
    itemData ? itemData.price : ""
  }" placeholder="0.01">
        </div>
        <div class="form-group">
            <label>Food Picture:</label>
            <input type="file" class="menuItemImage" data-index="${itemIndex}" accept="image/*">
            ${
              itemData && itemData.imageCID
                ? `<img src="${getIPFSImageURL(
                    itemData.imageCID
                  )}" class="image-preview">`
                : ""
            }
            <input type="hidden" class="menuItemImageCID" data-index="${itemIndex}" value="${
    itemData && itemData.imageCID ? itemData.imageCID : ""
  }">
        </div>
        <button type="button" class="btn-danger" onclick="removeMenuItem(${itemIndex})">Remove</button>
    `;

  container.appendChild(itemDiv);

  // Initialize empty menu item in temp array if creating new
  if (!itemData) {
    tempMenuItems.push({ name: "", price: "", description: "", imageCID: "" });
  }
}

/**
 * Remove a menu item from the temporary array and refresh display
 * @param {number} index - Index of menu item to remove
 */
function removeMenuItem(index) {
  tempMenuItems.splice(index, 1);
  displayTempMenu();
}

/**
 * Display all menu items currently in temporary storage
 * Called when loading a store or after adding/removing items
 */
function displayTempMenu() {
  const container = document.getElementById("menuItemsContainer");
  if (!container) return;
  container.innerHTML = "";
  tempMenuItems.forEach((item) => {
    addMenuItem(item);
  });
}

// ==================== SAVE STORE TO IPFS ====================

/**
 * Save store data (including menu and images) to IPFS
 * Updates registry and saves to localStorage
 */
async function saveStoreToIPFS() {
  showStatus("addStoreStatus", "Saving to IPFS...", "info");

  try {
    // Get form values
    const nameInput = document.getElementById("addStoreName");
    const descInput = document.getElementById("addStoreDescription");
    const addressInput = document.getElementById("addStoreStreetAddress");

    if (!nameInput || !addressInput) throw new Error("Form inputs not found");

    const name = nameInput.value;
    const description = descInput ? descInput.value : "";
    const streetAddress = addressInput.value;

    // Validate required fields
    if (!name) throw new Error("Store name is required");
    if (!streetAddress) throw new Error("Store street address is required");

    // Upload logo to IPFS if provided
    let logoCID = "";
    const logoInput = document.getElementById("addStoreLogo");
    if (logoInput && logoInput.files.length > 0) {
      showStatus("addStoreStatus", "Uploading logo...", "info");
      logoCID = await uploadFileToIPFS(logoInput.files[0]);
    }

    // Upload store picture to IPFS if provided
    let pictureCID = "";
    const pictureInput = document.getElementById("addStorePicture");
    if (pictureInput && pictureInput.files.length > 0) {
      showStatus("addStoreStatus", "Uploading picture...", "info");
      pictureCID = await uploadFileToIPFS(pictureInput.files[0]);
    }

    // Process menu items
    showStatus("addStoreStatus", "Processing menu...", "info");
    const menuItems = [];
    const menuItemNames = document.querySelectorAll(".menuItemName");
    const menuItemDescs = document.querySelectorAll(".menuItemDescription");
    const menuItemPrices = document.querySelectorAll(".menuItemPrice");
    const menuItemImages = document.querySelectorAll(".menuItemImage");
    const menuItemCIDs = document.querySelectorAll(".menuItemImageCID");

    // Loop through all menu items on the page
    for (let i = 0; i < menuItemNames.length; i++) {
      const itemName = menuItemNames[i].value;
      const itemDesc = menuItemDescs[i] ? menuItemDescs[i].value : "";
      const itemPrice = menuItemPrices[i].value;
      const itemImageInput = menuItemImages[i];
      let itemImageCID = menuItemCIDs[i] ? menuItemCIDs[i].value : "";

      // Skip items without name or price
      if (!itemName || !itemPrice) continue;

      // Upload menu item image if provided
      if (itemImageInput && itemImageInput.files.length > 0) {
        showStatus("addStoreStatus", `Uploading ${itemName} image...`, "info");
        itemImageCID = await uploadFileToIPFS(itemImageInput.files[0]);
      }

      // Add menu item to array
      menuItems.push({
        name: itemName,
        description: itemDesc,
        price: itemPrice,
        imageCID: itemImageCID,
      });
    }

    // Validate at least one menu item exists
    if (menuItems.length === 0)
      throw new Error("Add at least one menu item with name and price");

    // Create store data object
    const storeData = {
      name: name,
      description: description,
      streetAddress: streetAddress,
      logoCID: logoCID,
      pictureCID: pictureCID,
      menu: menuItems,
      createdAt: new Date().toISOString(),
    };

    // Upload complete store data to IPFS
    showStatus("addStoreStatus", "Uploading store data...", "info");
    const storeCID = await uploadJSONToIPFS(storeData);

    // Update registry (either modify existing or create new)
    const existingStoreSelect = document.getElementById("existingStoreSelect");
    if (existingStoreSelect) {
      const existingIndex = existingStoreSelect.value;
      if (existingIndex !== "") {
        // Update existing store
        ipfsRegistry.stores[existingIndex] = {
          name: name,
          cid: storeCID,
        };
      } else {
        // Add new store
        ipfsRegistry.stores.push({ name: name, cid: storeCID });
      }
    } else {
      ipfsRegistry.stores.push({ name: name, cid: storeCID });
    }

    // Save registry to localStorage
    saveIPFSRegistry();
    populateExistingStoresDropdown();
    populateRegisterStoreDropdown();

    showStatus("addStoreStatus", `Store saved! CID: ${storeCID}`, "success");
  } catch (error) {
    showStatus("addStoreStatus", `${error.message}`, "error");
  }
}
/**
 * Remove a store from the IPFS registry
 * Note: This only removes from local registry, not from IPFS itself
 */
function removeStore() {
  const select = document.getElementById("existingStoreSelect");
  if (!select) return;

  const index = select.value;
  if (index === "") {
    alert("Select a store to remove");
    return;
  }

  if (!confirm("Remove this store from registry? Data on IPFS will remain."))
    return;

  // Remove store from registry
  ipfsRegistry.stores.splice(index, 1);
  saveIPFSRegistry();

  // Clear form and refresh dropdowns
  select.value = "";
  loadExistingStore();
  populateExistingStoresDropdown();
  populateRegisterStoreDropdown();

  showStatus("addStoreStatus", "Store removed from registry", "success");
}

// ==================== REGISTER STORE ON BLOCKCHAIN ====================

/**
 * Register a store on the blockchain
 * Links an Ethereum address to a store's IPFS data
 */
async function registerStoreOnBlockchain() {
  try {
    const storeSelect = document.getElementById("registerStoreSelect");
    const accountSelect = document.getElementById("registerStoreAccount");

    if (!storeSelect || !accountSelect)
      throw new Error("Registration inputs not found");

    const storeIndex = storeSelect.value;
    const accountAddress = accountSelect.value;

    // Validate inputs
    if (!storeIndex) throw new Error("Select a store");
    if (!accountAddress) throw new Error("Select an account");

    // Check if account is already used
    if (usedAccounts.has(accountAddress)) {
      throw new Error("Account already in use");
    }

    // Check if this store already registered
    const isRegistered = await contract.methods
      .isStoreRegistered(accountAddress)
      .call();
    if (isRegistered) {
      throw new Error("Account already registered as a store");
    }

    showStatus(
      "registerStoreStatus",
      "Registering store on blockchain...",
      "info"
    );

    // Call smart contract registerStore function
    await contract.methods
      .registerStore()
      .send({ from: accountAddress, gas: 3000000 });

    // Map this address to this store CID - THIS IS THE KEY FIX
    const store = ipfsRegistry.stores[storeIndex];
    storeAddressMap[accountAddress] = store.cid;

    // Mark account as used
    usedAccounts.add(accountAddress);

    // Refresh displays
    populateAccountDropdowns();
    populateRegisterStoreDropdown();
    await loadRegisteredStores();

    showStatus("registerStoreStatus", "Store registered!", "success");
  } catch (error) {
    showStatus("registerStoreStatus", `${error.message}`, "error");
  }
}

/**
 * Load and display all stores registered on the blockchain
 */
async function loadRegisteredStores() {
  const listDiv = document.getElementById("registeredStoresList");
  if (!listDiv) return;

  let html = "";

  try {
    // Check all accounts for registered stores
    for (const account of accounts) {
      try {
        const isRegistered = await contract.methods
          .isStoreRegistered(account)
          .call();
        if (isRegistered) {
          const storeCID = storeAddressMap[account];
          if (storeCID) {
            const storeData = await getFromIPFS(storeCID);
            html += `
                            <div class="info-card">
                                <h4>${storeData.name}</h4>
                                <p>${storeData.description}</p>
                                <p><strong>Address:</strong> ${account}</p>
                                ${
                                  storeData.logoCID
                                    ? `<img src="${getIPFSImageURL(
                                        storeData.logoCID
                                      )}" class="ipfs-image">`
                                    : ""
                                }
                            </div>
                        `;
          }
          usedAccounts.add(account);
        }
      } catch (error) {
        continue;
      }
    }

    listDiv.innerHTML = html || "<p>No registered stores</p>";
    populateAccountDropdowns();
  } catch (error) {
    listDiv.innerHTML = `<p class="status error">Error: ${error.message}</p>`;
  }
}

// ==================== DRIVER FUNCTIONS ====================

/**
 * Populate dropdown with existing drivers from IPFS registry
 */
function populateExistingDriversDropdown() {
  const select = document.getElementById("existingDriverSelect");
  if (!select) return;
  select.innerHTML = '<option value="">-- Create New Driver --</option>';

  ipfsRegistry.drivers.forEach((driver, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = driver.name;
    select.appendChild(option);
  });
}

/**
 * Populate dropdown for driver registration
 */
function populateRegisterDriverDropdown() {
  const select = document.getElementById("registerDriverSelect");
  if (!select) return;
  select.innerHTML = '<option value="">-- Select a Driver --</option>';

  ipfsRegistry.drivers.forEach((driver, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = driver.name;
    select.appendChild(option);
  });
}

/**
 * Populate driver management dropdown (for driver panel)
 */
async function populateDriverNamesDropdown() {
  const select = document.getElementById("driverManageAccount");
  if (!select) return;
  select.innerHTML = '<option value="">-- Select Driver --</option>';

  // Check all accounts for registered drivers
  for (const account of accounts) {
    try {
      const isRegistered = await contract.methods
        .isDriverRegistered(account)
        .call();
      if (isRegistered) {
        const driverCID = driverAddressMap[account];
        let driverName = account.substring(0, 10) + "...";

        if (driverCID) {
          try {
            const driverData = await getFromIPFS(driverCID);
            driverName = driverData.name;
          } catch (e) {
            // Keep default name
          }
        }

        const option = document.createElement("option");
        option.value = account;
        option.textContent = driverName;
        select.appendChild(option);
        usedAccounts.add(account);
      }
    } catch (e) {
      continue;
    }
  }
}

/**
 * Load existing driver data from IPFS when selected
 */
async function loadExistingDriver() {
  const select = document.getElementById("existingDriverSelect");
  if (!select) return;
  const index = select.value;

  // Clear form if "Create New" selected
  if (index === "") {
    if (document.getElementById("addDriverName"))
      document.getElementById("addDriverName").value = "";
    if (document.getElementById("addDriverPhone"))
      document.getElementById("addDriverPhone").value = "";
    if (document.getElementById("addDriverVehicleType"))
      document.getElementById("addDriverVehicleType").value = "";
    if (document.getElementById("addDriverLicensePlate"))
      document.getElementById("addDriverLicensePlate").value = "";
    if (document.getElementById("driverPicturePreview"))
      document.getElementById("driverPicturePreview").style.display = "none";
    if (document.getElementById("carPicturePreview"))
      document.getElementById("carPicturePreview").style.display = "none";
    if (document.getElementById("addDriverPicture"))
      document.getElementById("addDriverPicture").value = "";
    if (document.getElementById("addCarPicture"))
      document.getElementById("addCarPicture").value = "";
    return;
  }

  try {
    // Fetch driver data from IPFS
    const driver = ipfsRegistry.drivers[index];
    const driverData = await getFromIPFS(driver.cid);

    // Populate form fields
    if (document.getElementById("addDriverName"))
      document.getElementById("addDriverName").value = driverData.name;
    if (document.getElementById("addDriverPhone"))
      document.getElementById("addDriverPhone").value = driverData.phone;
    if (document.getElementById("addDriverVehicleType"))
      document.getElementById("addDriverVehicleType").value =
        driverData.vehicleType;
    if (document.getElementById("addDriverLicensePlate"))
      document.getElementById("addDriverLicensePlate").value =
        driverData.licensePlate || "";

    // Display images if they exist
    if (
      driverData.pictureCID &&
      document.getElementById("driverPicturePreview")
    ) {
      document.getElementById("driverPicturePreview").src = getIPFSImageURL(
        driverData.pictureCID
      );
      document.getElementById("driverPicturePreview").style.display = "block";
    }
    if (
      driverData.carPictureCID &&
      document.getElementById("carPicturePreview")
    ) {
      document.getElementById("carPicturePreview").src = getIPFSImageURL(
        driverData.carPictureCID
      );
      document.getElementById("carPicturePreview").style.display = "block";
    }
  } catch (error) {
    alert("Error loading driver: " + error.message);
  }
}

/**
 * Save driver data to IPFS
 */
async function saveDriverToIPFS() {
  showStatus("addDriverStatus", "Saving to IPFS...", "info");

  try {
    // Get form values
    const nameInput = document.getElementById("addDriverName");
    const phoneInput = document.getElementById("addDriverPhone");
    const vehicleTypeInput = document.getElementById("addDriverVehicleType");
    const licensePlateInput = document.getElementById("addDriverLicensePlate");

    if (!nameInput || !phoneInput || !vehicleTypeInput)
      throw new Error("Driver inputs not found");

    const name = nameInput.value;
    const phone = phoneInput.value;
    const vehicleType = vehicleTypeInput.value;
    const licensePlate = licensePlateInput ? licensePlateInput.value : "";

    // Validate required fields
    if (!name) throw new Error("Driver name is required");
    if (!phone) throw new Error("Phone is required");
    if (!vehicleType) throw new Error("Vehicle type is required");

    // Upload driver picture to IPFS if provided
    let pictureCID = "";
    const pictureInput = document.getElementById("addDriverPicture");
    if (pictureInput && pictureInput.files.length > 0) {
      showStatus("addDriverStatus", "Uploading picture...", "info");
      pictureCID = await uploadFileToIPFS(pictureInput.files[0]);
    }

    // Upload car picture to IPFS if provided
    let carPictureCID = "";
    const carPictureInput = document.getElementById("addCarPicture");
    if (carPictureInput && carPictureInput.files.length > 0) {
      showStatus("addDriverStatus", "Uploading car picture...", "info");
      carPictureCID = await uploadFileToIPFS(carPictureInput.files[0]);
    }

    // Create driver data object
    const driverData = {
      name: name,
      phone: phone,
      vehicleType: vehicleType,
      licensePlate: licensePlate,
      pictureCID: pictureCID,
      carPictureCID: carPictureCID,
      createdAt: new Date().toISOString(),
    };

    // Upload complete driver data to IPFS
    showStatus("addDriverStatus", "Uploading driver data...", "info");
    const driverCID = await uploadJSONToIPFS(driverData);

    // Update registry
    const existingDriverSelect = document.getElementById(
      "existingDriverSelect"
    );
    if (existingDriverSelect) {
      const existingIndex = existingDriverSelect.value;
      if (existingIndex !== "") {
        // Update existing driver
        ipfsRegistry.drivers[existingIndex] = {
          name: name,
          cid: driverCID,
        };
      } else {
        // Add new driver
        ipfsRegistry.drivers.push({ name: name, cid: driverCID });
      }
    } else {
      ipfsRegistry.drivers.push({ name: name, cid: driverCID });
    }

    // Save and refresh
    saveIPFSRegistry();
    populateExistingDriversDropdown();
    populateRegisterDriverDropdown();

    showStatus(
      "addDriverStatus",
      `Driver saved! CID: ${driverCID}`,
      "success"
    );
  } catch (error) {
    showStatus("addDriverStatus", `${error.message}`, "error");
  }
}

/**
 * Remove driver from registry
 */
function removeDriver() {
  const select = document.getElementById("existingDriverSelect");
  if (!select) return;

  const index = select.value;
  if (index === "") {
    alert("Select a driver to remove");
    return;
  }

  if (!confirm("Remove this driver from registry?")) return;

  ipfsRegistry.drivers.splice(index, 1);
  saveIPFSRegistry();

  select.value = "";
  loadExistingDriver();
  populateExistingDriversDropdown();
  populateRegisterDriverDropdown();

  showStatus("addDriverStatus", "Driver removed from registry", "success");
}

/**
 * Register driver on blockchain
 */
async function registerDriverOnBlockchain() {
  try {
    const driverSelect = document.getElementById("registerDriverSelect");
    const accountSelect = document.getElementById("registerDriverAccount");

    if (!driverSelect || !accountSelect)
      throw new Error("Registration inputs not found");

    const driverIndex = driverSelect.value;
    const accountAddress = accountSelect.value;

    if (!driverIndex) throw new Error("Select a driver");
    if (!accountAddress) throw new Error("Select an account");

    if (usedAccounts.has(accountAddress)) {
      throw new Error("Account already in use");
    }

    const isRegistered = await contract.methods
      .isDriverRegistered(accountAddress)
      .call();
    if (isRegistered) {
      throw new Error("Account already registered as a driver");
    }

    showStatus("registerDriverStatus", "Registering driver...", "info");

    // Call smart contract registerDriver function
    await contract.methods
      .registerDriver()
      .send({ from: accountAddress, gas: 3000000 });

    // Map this address to this driver CID - THIS IS THE KEY FIX
    const driver = ipfsRegistry.drivers[driverIndex];
    driverAddressMap[accountAddress] = driver.cid;

    usedAccounts.add(accountAddress);

    populateAccountDropdowns();
    populateRegisterDriverDropdown();
    await populateDriverNamesDropdown();
    await loadRegisteredDrivers();

    showStatus("registerDriverStatus", "Driver registered!", "success");
  } catch (error) {
    showStatus("registerDriverStatus", `${error.message}`, "error");
  }
}

/**
 * Load and display all registered drivers
 */
async function loadRegisteredDrivers() {
  const listDiv = document.getElementById("registeredDriversList");
  if (!listDiv) return;

  let html = "";

  try {
    // Check all accounts for registered drivers
    for (const account of accounts) {
      try {
        const isRegistered = await contract.methods
          .isDriverRegistered(account)
          .call();
        if (isRegistered) {
          const driverCID = driverAddressMap[account];
          if (driverCID) {
            const driverData = await getFromIPFS(driverCID);
            html += `
                            <div class="info-card">
                                <h4>${driverData.name}</h4>
                                <p>${driverData.phone} | ${
              driverData.vehicleType
            }</p>
                                <p><strong>Address:</strong> ${account}</p>
                                ${
                                  driverData.pictureCID
                                    ? `<img src="${getIPFSImageURL(
                                        driverData.pictureCID
                                      )}" class="ipfs-image">`
                                    : ""
                                }
                            </div>
                        `;
          }
          usedAccounts.add(account);
        }
      } catch (error) {
        continue;
      }
    }

    listDiv.innerHTML = html || "<p>No registered drivers</p>";
    populateAccountDropdowns();
  } catch (error) {
    listDiv.innerHTML = `<p class="status error">Error: ${error.message}</p>`;
  }
}
// ==================== CUSTOMER FUNCTIONS ====================

/**
 * Populate dropdown with existing customers from IPFS registry
 */
function populateExistingCustomersDropdown() {
  const select = document.getElementById("existingCustomerSelect");
  if (!select) return;
  select.innerHTML = '<option value="">-- Create New --</option>';

  ipfsRegistry.customers.forEach((customer, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = customer.name;
    select.appendChild(option);
  });
}

/**
 * Populate customer names dropdown for order placement
 */
function populateCustomerNamesDropdown() {
  const select = document.getElementById("customerNameSelect");
  if (!select) return;
  select.innerHTML = '<option value="">-- Select Customer --</option>';

  ipfsRegistry.customers.forEach((customer, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = customer.name;
    select.appendChild(option);
  });
}

/**
 * Load existing customer data from IPFS
 */
async function loadExistingCustomer() {
  const select = document.getElementById("existingCustomerSelect");
  if (!select) return;
  const index = select.value;

  if (index === "") {
    if (document.getElementById("addCustomerName"))
      document.getElementById("addCustomerName").value = "";
    if (document.getElementById("addCustomerAddress"))
      document.getElementById("addCustomerAddress").value = "";
    if (document.getElementById("addCustomerPhone"))
      document.getElementById("addCustomerPhone").value = "";
    if (document.getElementById("customerPicturePreview"))
      document.getElementById("customerPicturePreview").style.display = "none";
    if (document.getElementById("addCustomerPicture"))
      document.getElementById("addCustomerPicture").value = "";
    return;
  }

  try {
    const customer = ipfsRegistry.customers[index];
    const customerData = await getFromIPFS(customer.cid);

    if (document.getElementById("addCustomerName"))
      document.getElementById("addCustomerName").value = customerData.name;
    if (document.getElementById("addCustomerAddress"))
      document.getElementById("addCustomerAddress").value =
        customerData.deliveryAddress;
    if (document.getElementById("addCustomerPhone"))
      document.getElementById("addCustomerPhone").value = customerData.phone;

    if (
      customerData.pictureCID &&
      document.getElementById("customerPicturePreview")
    ) {
      document.getElementById("customerPicturePreview").src = getIPFSImageURL(
        customerData.pictureCID
      );
      document.getElementById("customerPicturePreview").style.display = "block";
    }
  } catch (error) {
    alert("Error loading customer: " + error.message);
  }
}

/**
 * Save customer data to IPFS
 */
async function saveCustomerToIPFS() {
  showStatus("addCustomerStatus", "Saving to IPFS...", "info");

  try {
    const nameInput = document.getElementById("addCustomerName");
    const addressInput = document.getElementById("addCustomerAddress");
    const phoneInput = document.getElementById("addCustomerPhone");

    if (!nameInput || !addressInput)
      throw new Error("Customer inputs not found");

    const name = nameInput.value;
    const deliveryAddress = addressInput.value;
    const phone = phoneInput ? phoneInput.value : "";

    if (!name) throw new Error("Name is required");
    if (!deliveryAddress) throw new Error("Delivery address is required");

    let pictureCID = "";
    const pictureInput = document.getElementById("addCustomerPicture");
    if (pictureInput && pictureInput.files.length > 0) {
      showStatus("addCustomerStatus", "Uploading picture...", "info");
      pictureCID = await uploadFileToIPFS(pictureInput.files[0]);
    }

    const customerData = {
      name: name,
      deliveryAddress: deliveryAddress,
      phone: phone,
      pictureCID: pictureCID,
      createdAt: new Date().toISOString(),
    };

    showStatus("addCustomerStatus", "Uploading customer data...", "info");
    const customerCID = await uploadJSONToIPFS(customerData);

    const existingCustomerSelect = document.getElementById(
      "existingCustomerSelect"
    );
    if (existingCustomerSelect) {
      const existingIndex = existingCustomerSelect.value;
      if (existingIndex !== "") {
        ipfsRegistry.customers[existingIndex] = {
          name: name,
          cid: customerCID,
        };
      } else {
        ipfsRegistry.customers.push({ name: name, cid: customerCID });
      }
    } else {
      ipfsRegistry.customers.push({ name: name, cid: customerCID });
    }

    saveIPFSRegistry();
    populateExistingCustomersDropdown();
    populateCustomerNamesDropdown();

    showStatus(
      "addCustomerStatus",
      `Customer saved! CID: ${customerCID}`,
      "success"
    );
  } catch (error) {
    showStatus("addCustomerStatus", `${error.message}`, "error");
  }
}

/**
 * Remove customer from registry
 */
function removeCustomer() {
  const index = document.getElementById("existingCustomerSelect").value;
  if (index === "") {
    alert("Select a customer to remove");
    return;
  }

  if (!confirm("Remove this customer from registry?")) return;

  ipfsRegistry.customers.splice(index, 1);
  saveIPFSRegistry();

  document.getElementById("existingCustomerSelect").value = "";
  loadExistingCustomer();
  populateExistingCustomersDropdown();
  populateCustomerNamesDropdown();

  showStatus(
    "addCustomerStatus",
    "Customer removed from registry",
    "success"
  );
}

// ==================== CUSTOMER ORDER FUNCTIONS ====================

/**
 * Load customer profile when selected by name
 */
async function loadCustomerByName() {
  const select = document.getElementById("customerNameSelect");
  const index = select.value;
  const profileDiv = document.getElementById("customerProfileDisplay");
  const accountSelectDiv = document.getElementById("customerAccountSelectDiv");
  const availableStoresDiv = document.getElementById("availableStoresDisplay");
  const selectedStoreMenuDiv = document.getElementById("selectedStoreMenu");
  const customerOrdersListDiv = document.getElementById("customerOrdersList");

  // Clear everything when changing customer or deselecting
  if (index === "") {
    profileDiv.innerHTML = "";
    accountSelectDiv.classList.add("hidden");
    availableStoresDiv.innerHTML = "";
    selectedStoreMenuDiv.classList.add("hidden");
    customerOrdersListDiv.innerHTML = "";
    cart = [];
    selectedStoreAddress = null;
    selectedStoreData = null;
    return;
  }

  // Clear previous customer's data
  availableStoresDiv.innerHTML = "";
  selectedStoreMenuDiv.classList.add("hidden");
  customerOrdersListDiv.innerHTML = "";
  cart = [];
  selectedStoreAddress = null;
  selectedStoreData = null;

  try {
    const customer = ipfsRegistry.customers[index];
    const customerData = await getFromIPFS(customer.cid);

    // Check if customer has linked wallet in session
    let linkedAccount = sessionStorage.getItem(`customer_${index}_account`);

    // Validate linked account still exists in accounts array
    if (linkedAccount && !accounts.includes(linkedAccount)) {
      sessionStorage.removeItem(`customer_${index}_account`);
      usedAccounts.delete(linkedAccount);
      linkedAccount = null;
    }

    if (!linkedAccount) {
      // Show account selection to link wallet
      accountSelectDiv.classList.remove("hidden");
      populateAccountDropdowns();
      profileDiv.innerHTML = `<p class="status info">Link an Ethereum account to place orders.</p>`;
    } else {
      // Display customer profile
      accountSelectDiv.classList.add("hidden");
      profileDiv.innerHTML = `
                <div class="info-card">
                    <h4>${customerData.name}</h4>
                    <p><strong>Delivery Address:</strong> ${
                      customerData.deliveryAddress
                    }</p>
                    <p><strong>Phone:</strong> ${customerData.phone}</p>
                    <p><strong>Wallet:</strong> ${linkedAccount.substring(
                      0,
                      15
                    )}...</p>
                    ${
                      customerData.pictureCID
                        ? `<img src="${getIPFSImageURL(
                            customerData.pictureCID
                          )}" class="ipfs-image">`
                        : ""
                    }
                    <button onclick="unlinkCustomerAccount(${index})" class="btn-danger">Unlink Account</button>
                </div>
            `;

      // Check if customer has active orders
      const orderIds = await contract.methods
        .getCustomerOrders(linkedAccount)
        .call();
      let hasActiveOrders = false;

      if (orderIds.length > 0) {
        for (const orderId of orderIds) {
          const order = await contract.methods.orders(orderId).call();
          // Check if order is not completed (5) or cancelled (6)
          if (order.status != 5 && order.status != 6) {
            hasActiveOrders = true;
            break;
          }
        }
      }

      // Only load and display orders if there are any
      if (orderIds.length > 0) {
        startCustomerOrderRefresh(linkedAccount);
      } else {
        customerOrdersListDiv.innerHTML = "<p>No orders yet</p>";
      }

      // FIXED: Auto-load stores when customer has a linked account
      await loadRegisteredStoresForCustomer();
    }
  } catch (error) {
    profileDiv.innerHTML = `<p class="status error">Error: ${error.message}</p>`;
  }
}

/**
 * Link an Ethereum account to a customer profile
 */
function linkCustomerAccount() {
  const customerIndex = document.getElementById("customerNameSelect").value;
  const accountAddress = document.getElementById("customerAccountSelect").value;

  if (!customerIndex || !accountAddress) {
    alert("Select an account");
    return;
  }

  if (usedAccounts.has(accountAddress)) {
    alert("Account already in use");
    return;
  }

  // Store in session (will be cleared on page reload)
  sessionStorage.setItem(`customer_${customerIndex}_account`, accountAddress);
  usedAccounts.add(accountAddress);
  populateAccountDropdowns();

  // FIXED: Hide the account selection div after linking
  const accountSelectDiv = document.getElementById("customerAccountSelectDiv");
  if (accountSelectDiv) {
    accountSelectDiv.classList.add("hidden");
  }

  // FIXED: Load registered stores for customer ordering
  loadRegisteredStoresForCustomer();
  
  // Reload customer display
  loadCustomerByName();
}

/**
 * Load registered stores into customer order dropdown
 */
async function loadRegisteredStoresForCustomer() {
  const storeSelect = document.getElementById("orderStoreSelect");
  if (!storeSelect) return;

  try {
    // Clear existing options except the default
    storeSelect.innerHTML = '<option value="">Select Store</option>';

    // Check if contract is initialized
    if (!contract) {
      console.error("Contract not initialized");
      showStatus("customerProfileDisplay", "Please connect to blockchain first", "error");
      return;
    }

    // Check all accounts for registered stores
    for (const account of accounts) {
      try {
        const isRegistered = await contract.methods
          .isStoreRegistered(account)
          .call();
        
        if (isRegistered) {
          const storeCID = storeAddressMap[account];
          if (storeCID) {
            const storeData = await getFromIPFS(storeCID);
            
            // Add store to dropdown
            const option = document.createElement("option");
            option.value = account;
            option.textContent = storeData.name;
            option.dataset.storeCID = storeCID; // Store CID for later use
            storeSelect.appendChild(option);
          }
        }
      } catch (error) {
        console.error(`Error checking store ${account}:`, error);
        continue;
      }
    }

    // Enable the select if stores are found
    if (storeSelect.options.length > 1) {
      storeSelect.disabled = false;
      showStatus("customerProfileDisplay", "Stores loaded successfully", "success");
    } else {
      showStatus("customerProfileDisplay", "No stores available", "warning");
    }
  } catch (error) {
    console.error("Error loading stores:", error);
    showStatus("customerProfileDisplay", `Error loading stores: ${error.message}`, "error");
  }
}

function unlinkCustomerAccount(customerIndex) {
  const linkedAccount = sessionStorage.getItem(
    `customer_${customerIndex}_account`
  );
  if (linkedAccount) {
    sessionStorage.removeItem(`customer_${customerIndex}_account`);
    usedAccounts.delete(linkedAccount);
    populateAccountDropdowns();
    loadCustomerByName();
  }
}

/**
 * Start listening for order events for customer
 * @param {string} customerAddress - Ethereum address of customer
 */
function startCustomerOrderRefresh(customerAddress) {
  // Load orders immediately
  loadCustomerOrders(customerAddress);

  // Listen for OrderStateChanged events
  if (contract && contract.events) {
    contract.events
      .OrderStateChanged({
        fromBlock: "latest",
      })
      .on("data", async (event) => {
        // Reload orders when any order state changes
        await loadCustomerOrders(customerAddress);
      })
      .on("error", console.error);

    // Listen for OrderPlaced events
    contract.events
      .OrderPlaced({
        filter: { customer: customerAddress },
        fromBlock: "latest",
      })
      .on("data", async (event) => {
        await loadCustomerOrders(customerAddress);
      })
      .on("error", console.error);
  }
}

/**
 * Load and display customer's order history
 * @param {string} customerAddress - Ethereum address of customer
 */
async function loadCustomerOrders(customerAddress) {
  try {
    // Get order IDs for this customer from smart contract
    const orderIds = await contract.methods
      .getCustomerOrders(customerAddress)
      .call();

    if (orderIds.length === 0) {
      document.getElementById("customerOrdersList").innerHTML =
        "<p>No orders yet</p>";
      return;
    }

    let html = "";
    // Load each order's details
    for (const orderId of orderIds) {
      const order = await contract.methods.orders(orderId).call();
      // formatOrderCard shows confirm button for delivered orders
      html += await formatOrderCard(orderId, order, true, false);
    }
    document.getElementById("customerOrdersList").innerHTML = html;
  } catch (error) {
    document.getElementById(
      "customerOrdersList"
    ).innerHTML = `<p class="status error">Error: ${error.message}</p>`;
  }
}

/**
 * Load available stores that customers can order from
 */
async function loadAvailableStoresForCustomer() {
  const displayDiv = document.getElementById("availableStoresDisplay");
  displayDiv.innerHTML = "<p>Loading registered stores...</p>";

  try {
    let html = "";

    // Check all accounts for registered stores
    for (const account of accounts) {
      try {
        const isRegistered = await contract.methods
          .isStoreRegistered(account)
          .call();
        if (isRegistered) {
          const storeCID = storeAddressMap[account];
          if (storeCID) {
            const storeData = await getFromIPFS(storeCID);
            html += `
                            <div class="store-card" onclick="selectStore('${account}', '${storeCID}')">
                                <h4>${storeData.name}</h4>
                                <p>${storeData.description}</p>
                                <p><strong>Address:</strong> ${
                                  storeData.streetAddress
                                }</p>
                                ${
                                  storeData.logoCID
                                    ? `<img src="${getIPFSImageURL(
                                        storeData.logoCID
                                      )}" class="ipfs-image">`
                                    : ""
                                }
                                <button>View Menu</button>
                            </div>
                        `;
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (html === "") {
      displayDiv.innerHTML =
        "<p>No registered stores available. Please ensure stores are registered on the blockchain.</p>";
    } else {
      displayDiv.innerHTML = html;
    }
  } catch (error) {
    displayDiv.innerHTML = `<p class="status error">Error: ${error.message}</p>`;
  }
}

/**
 * Select a store and display its menu
 * @param {string} storeAddress - Ethereum address of store
 * @param {string} storeCID - IPFS CID of store data
 */
async function selectStore(storeAddress, storeCID) {
  try {
    selectedStoreAddress = storeAddress;
    selectedStoreData = await getFromIPFS(storeCID);

    // Show menu section
    document.getElementById("selectedStoreMenu").classList.remove("hidden");

    // Display menu items
    let menuHTML = "";
    selectedStoreData.menu.forEach((item, index) => {
      menuHTML += `
                <div class="menu-card">
                    <h4>${item.name}</h4>
                    <p>${item.description}</p>
                    <p><strong>Price:</strong> ${item.price} ETH</p>
                    ${
                      item.imageCID
                        ? `<img src="${getIPFSImageURL(
                            item.imageCID
                          )}" class="ipfs-image">`
                        : ""
                    }
                    <div class="form-group" style="margin-top: 10px;">
                        <label>Quantity:</label>
                        <input type="number" id="menuQuantity${index}" value="1" min="1" style="width: 80px;">
                    </div>
                    <button onclick="addToCart(${index})">Add to Cart</button>
                </div>
            `;
    });
    document.getElementById("menuDisplay").innerHTML = menuHTML;

    // Clear cart for new store selection
    cart = [];
    updateCartDisplay();
  } catch (error) {
    alert("Error loading store: " + error.message);
  }
}

/**
 * Add menu item to shopping cart
 * @param {number} itemIndex - Index of menu item in store's menu array
 */
function addToCart(itemIndex) {
  const item = selectedStoreData.menu[itemIndex];
  const quantityInput = document.getElementById(`menuQuantity${itemIndex}`);
  const quantity = parseInt(quantityInput.value) || 1;

  // Check if item already in cart
  const existingItem = cart.find((i) => i.name === item.name);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.push({ ...item, quantity: quantity });
  }

  // Reset quantity input
  quantityInput.value = 1;

  updateCartDisplay();
}

/**
 * Remove item from shopping cart
 * @param {number} cartIndex - Index of item in cart array
 */
function removeFromCart(cartIndex) {
  cart.splice(cartIndex, 1);
  updateCartDisplay();
}

/**
 * Update quantity of item in cart
 * @param {number} cartIndex - Index of item in cart array
 * @param {number} newQuantity - New quantity value
 */
function updateCartQuantity(cartIndex, newQuantity) {
  if (newQuantity <= 0) {
    removeFromCart(cartIndex);
  } else {
    cart[cartIndex].quantity = parseInt(newQuantity);
    updateCartDisplay();
  }
}

/**
 * Update shopping cart display with current items and totals
 */
function updateCartDisplay() {
  const cartDiv = document.getElementById("cartItems");
  const summaryDiv = document.getElementById("cartSummary");

  if (cart.length === 0) {
    cartDiv.innerHTML = "<p>Cart is empty</p>";
    summaryDiv.classList.add("hidden");
    return;
  }

  // Display cart items
  let cartHTML = "";
  cart.forEach((item, index) => {
    const itemTotal = (parseFloat(item.price) * item.quantity).toFixed(4);
    cartHTML += `
            <div class="cart-item">
                <strong>${item.name}</strong> - ${item.price} ETH each<br>
                <input type="number" value="${item.quantity}" min="0" onchange="updateCartQuantity(${index}, this.value)" style="width: 60px;">
                <span>Subtotal: ${itemTotal} ETH</span>
                <button class="btn-danger" onclick="removeFromCart(${index})">Remove</button>
            </div>
        `;
  });
  cartDiv.innerHTML = cartHTML;

  // Calculate totals
  const foodTotal = cart.reduce(
    (sum, item) => sum + parseFloat(item.price) * item.quantity,
    0
  );
  const foodTip = parseFloat(document.getElementById("foodTip").value) || 0;
  const deliveryTip =
    parseFloat(document.getElementById("deliveryTip").value) || 0;
  const totalAmount =
    foodTotal + foodTip + DELIVERY_FEE + deliveryTip + ORDER_PROCESSING_FEE;

  // Display summary
  summaryDiv.classList.remove("hidden");
  summaryDiv.innerHTML = `
        <h4>Order Summary</h4>
        <p>Food Total: ${foodTotal.toFixed(4)} ETH</p>
        <p>Food Tip: ${foodTip.toFixed(4)} ETH</p>
        <p>Delivery Fee: ${DELIVERY_FEE.toFixed(4)} ETH</p>
        <p>Delivery Tip: ${deliveryTip.toFixed(4)} ETH</p>
        <p>Processing Fee: ${ORDER_PROCESSING_FEE.toFixed(4)} ETH</p>
        <p><strong>Total: ${totalAmount.toFixed(4)} ETH</strong></p>
    `;
}
/**
 * Place order on blockchain
 * Sends transaction with payment to smart contract
 */
async function placeOrder() {
  try {
    const customerIndex = document.getElementById("customerNameSelect").value;
    if (!customerIndex) throw new Error("Select customer profile");

    const customerAccount = sessionStorage.getItem(
      `customer_${customerIndex}_account`
    );
    if (!customerAccount) throw new Error("Link wallet first");

    if (cart.length === 0) throw new Error("Cart is empty");
    if (!selectedStoreAddress) throw new Error("Select a store");

    showStatus("orderStatus", "Placing order...", "info");

    // Calculate all amounts in Wei (smallest ETH unit)
    const foodTotal = cart.reduce(
      (sum, item) => sum + parseFloat(item.price) * item.quantity,
      0
    );
    const foodTip = parseFloat(document.getElementById("foodTip").value) || 0;
    const deliveryTip =
      parseFloat(document.getElementById("deliveryTip").value) || 0;

    const foodTotalWei = web3.utils.toWei(foodTotal.toFixed(18), "ether");
    const foodTipWei = web3.utils.toWei(foodTip.toFixed(18), "ether");
    const deliveryFeeWei = web3.utils.toWei(DELIVERY_FEE.toFixed(18), "ether");
    const deliveryTipWei = web3.utils.toWei(deliveryTip.toFixed(18), "ether");
    const processingFeeWei = web3.utils.toWei(
      ORDER_PROCESSING_FEE.toFixed(18),
      "ether"
    );

    // Calculate total using BigNumber to avoid precision issues
    const totalAmountWei = web3.utils
      .toBN(foodTotalWei)
      .add(web3.utils.toBN(foodTipWei))
      .add(web3.utils.toBN(deliveryFeeWei))
      .add(web3.utils.toBN(deliveryTipWei))
      .add(web3.utils.toBN(processingFeeWei));

    // Call smart contract placeOrder function
    const receipt = await contract.methods
      .placeOrder(
        selectedStoreAddress,
        foodTotalWei,
        foodTipWei,
        deliveryFeeWei,
        deliveryTipWei,
        processingFeeWei
      )
      .send({
        from: customerAccount,
        value: totalAmountWei.toString(),
        gas: 3000000,
      });

    // Clear cart after successful order
    cart = [];
    updateCartDisplay();

    showStatus(
      "orderStatus",
      `Order placed! Order ID: ${receipt.events.OrderPlaced.returnValues.orderId}`,
      "success"
    );

    // Reload orders to show new order
    await loadCustomerOrders(customerAccount);
  } catch (error) {
    showStatus("orderStatus", `${error.message}`, "error");
  }
}

/**
 * Customer confirms order has been delivered
 * Triggers payment distribution to store and driver
 * @param {number} orderId - Order ID to confirm
 */
async function confirmOrderDelivery(orderId) {
  try {
    const customerIndex = document.getElementById("customerNameSelect").value;
    if (!customerIndex) throw new Error("Select customer profile");

    const customerAccount = sessionStorage.getItem(
      `customer_${customerIndex}_account`
    );
    if (!customerAccount) throw new Error("Link wallet first");
    

    await contract.methods.placeOrder(storeAddress, itemIndices).send({
      from: currentAccount,
      value: totalPriceWei,
      gas: 3000000,
    });

    showStatus("orderStatus", "Order placed successfully!", "success");

    // Clear cart
    cart = [];
    updateCartDisplay();

    // Refresh order lists
    loadStoreOrders();
    loadDriverOrders();
  } catch (error) {
    showStatus("orderStatus", `${error.message}`, "error");
  }
}

// ==================== ORDER MANAGEMENT FUNCTIONS ====================

/**
 * Load orders for the store panel
 */
async function loadStoreOrders() {
  const listDiv = document.getElementById("storeOrdersList");
  if (!listDiv) return;


  try {
    const orderCount = await contract.methods.orderCounter().call();
    let html = "";

    for (let i = 1; i <= orderCount; i++) {
      const order = await contract.methods.orders(i).call();

      // Only show orders for the current account if it's a store
      // Or show all for demo

      const statusText = [
        "Created",
        "Accepted",
        "Ready",
        "Picked Up",
        "Delivered",
      ][order.status];
      const totalEth = web3.utils.fromWei(order.totalAmount, "ether");

      html += `
                <div class="order-card">
                    <div class="order-header">
                        <strong>Order #${order.id}</strong>
                        <span class="status-badge status-${
                          order.status
                        }">${statusText}</span>
                    </div>
                    <p>Amount: ${parseFloat(totalEth).toFixed(4)} ETH</p>
                    <p>Customer: ${order.customer.substring(0, 10)}...</p>
                    ${
                      order.driver !==
                      "0x0000000000000000000000000000000000000000"
                        ? `<p>Driver: ${order.driver.substring(0, 10)}...</p>`
                        : "<p>Driver: Pending</p>"
                    }
                    
                    <div class="action-buttons">
                        ${
                          order.status == 0
                            ? `<button onclick="updateOrderStatus(${order.id}, 1)">Accept Order</button>`
                            : ""
                        }
                        ${
                          order.status == 1
                            ? `<button onclick="updateOrderStatus(${order.id}, 2)">Mark Ready</button>`
                            : ""
                        }
                    </div>
                </div>
            `;
    }

    listDiv.innerHTML = html || "<p>No orders found</p>";
  } catch (error) {
    listDiv.innerHTML = `<p class="error">Error loading orders: ${error.message}</p>`;
  }
}

/**
 * Load available orders for drivers
 */
async function loadDriverOrders() {
  const listDiv = document.getElementById("driverOrdersList");
  if (!listDiv) return;

  try {
    const orderCount = await contract.methods.orderCounter().call();
    let html = "";

    for (let i = 1; i <= orderCount; i++) {
      const order = await contract.methods.orders(i).call();

      // Drivers look for orders with status 2 (Ready) or orders they already claimed

      if (
        order.status == 2 ||
        (order.driver === currentAccount && order.status < 4)
      ) {
        const statusText = [
          "Created",
          "Accepted",
          "Ready",
          "Picked Up",
          "Delivered",
        ][order.status];
        const totalEth = web3.utils.fromWei(order.totalAmount, "ether");

        html += `
                    <div class="order-card">
                        <div class="order-header">
                            <strong>Order #${order.id}</strong>
                            <span class="status-badge status-${
                              order.status
                            }">${statusText}</span>
                        </div>
                        <p>Amount: ${parseFloat(totalEth).toFixed(4)} ETH</p>
                        <p>Store: ${order.store.substring(0, 10)}...</p>
                        <p>Customer: ${order.customer.substring(0, 10)}...</p>
                        
                        <div class="action-buttons">
                            ${
                              order.status == 2
                                ? `<button onclick="acceptDelivery(${order.id})">Accept Delivery</button>`
                                : ""
                            }
                            ${
                              order.status == 3 &&
                              order.driver === currentAccount
                                ? `<button onclick="updateOrderStatus(${order.id}, 4)">Mark Delivered</button>`
                                : ""
                            }
                        </div>
                    </div>
                `;
      }
    }

    listDiv.innerHTML = html || "<p>No available orders</p>";
  } catch (error) {
    listDiv.innerHTML = `<p class="error">Error loading orders: ${error.message}</p>`;
  }
}

/**
 * Update order status (for stores and drivers)
 * @param {number} orderId - ID of the order
 * @param {number} newStatus - New status code
 */
async function updateOrderStatus(orderId, newStatus) {
  try {
    showStatus("connectionStatus", `Updating order #${orderId}...`, "info");

    await contract.methods.updateOrderStatus(orderId, newStatus).send({
      from: currentAccount,
      gas: 200000,
    });

    showStatus("connectionStatus", "Status updated!", "success");

    // Refresh all lists
    loadStoreOrders();
    loadDriverOrders();
  } catch (error) {
    showStatus("connectionStatus", `Error: ${error.message}`, "error");
  }
}

/**
 * Driver accepts a delivery
 * @param {number} orderId - ID of the order
 */
async function acceptDelivery(orderId) {
  try {
    showStatus("connectionStatus", `Accepting delivery #${orderId}...`, "info");

    await contract.methods.acceptDelivery(orderId).send({
      from: currentAccount,
      gas: 200000,
    });

    showStatus("connectionStatus", "Delivery accepted!", "success");

    // Refresh all lists
    loadStoreOrders();
    loadDriverOrders();
  } catch (error) {
    showStatus("connectionStatus", `Error: ${error.message}`, "error");
  }
}


/**
 * Load customer's order history
 */
async function loadCustomerOrders() {
  // This function is a placeholder for customer order history
  // Implementation would be similar to loadStoreOrders but filtered for customer
}

/**
 * Confirm order delivery (by customer)
 * @param {number} orderId - ID of the order to confirm
 */
async function confirmOrderDelivered(orderId) {
  try {
    const customerIndex = document.getElementById("customerNameSelect").value;
    if (!customerIndex) throw new Error("Select a customer");

   
    // we'll assume the current account is the customer or we have a way to get it

    if (!confirm("Confirm you received the order?")) return;

    showStatus("orderStatus", "Confirming delivery...", "info");

    // Call smart contract confirmOrderDelivered function
    await contract.methods.confirmOrderDelivered(orderId).send({
      from: currentAccount,
      gas: 3000000,
    });

    showStatus("orderStatus", `Order completed!`, "success");

    // Reload orders to show updated status
    await loadCustomerOrders();
  } catch (error) {
    showStatus("orderStatus", `${error.message}`, "error");
  }
}

// ==================== STORE MANAGEMENT ====================

/**
 * Populate store management dropdown with registered stores
 */
async function populateStoreManageDropdown() {
  const select = document.getElementById("storeManageSelect");
  if (!select) return; // Added null check
  select.innerHTML = '<option value="">-- Select Store --</option>';

  // Check all accounts for registered stores
  for (const account of accounts) {
    try {
      const isRegistered = await contract.methods
        .isStoreRegistered(account)
        .call();
      if (isRegistered) {
        const storeCID = storeAddressMap[account];
        let storeName = account.substring(0, 10) + "...";

        if (storeCID) {
          try {
            const storeData = await getFromIPFS(storeCID);
            storeName = storeData.name;
          } catch (e) {
            // Keep default name
          }
        }

        const option = document.createElement("option");
        option.value = account;
        option.textContent = storeName;
        select.appendChild(option);
        usedAccounts.add(account);
      }
    } catch (e) {
      continue;
    }
  }
}

/**
 * Load store information and set up management interface
 */
async function loadStoreInfo() {
  const storeAddr = document.getElementById("storeManageSelect").value;
  const infoDiv = document.getElementById("storeInfoDisplay");
  if (!infoDiv) return; // Added null check

  if (!storeAddr) {
    infoDiv.innerHTML = "";
    return;
  }

  try {
    // Verify store is registered
    const isRegistered = await contract.methods
      .isStoreRegistered(storeAddr)
      .call();

    if (!isRegistered) {
      infoDiv.innerHTML = '<p class="status info">Not registered.</p>';
      return;
    }

    // Load store data from IPFS using address map
    const storeCID = storeAddressMap[storeAddr];

    if (storeCID) {
      const storeData = await getFromIPFS(storeCID);
      infoDiv.innerHTML = `
                <div class="info-card">
                    <h4>${storeData.name}</h4>
                    <p>${storeData.description}</p>
                    <p><strong>Address:</strong> ${storeData.streetAddress}</p>
                    ${
                      storeData.logoCID
                        ? `<img src="${getIPFSImageURL(
                            storeData.logoCID
                          )}" class="ipfs-image">`
                        : ""
                    }
                </div>
            `;
    } else {
      infoDiv.innerHTML = '<p class="status info">Registered.</p>';
    }

    // Auto-load all orders
    await loadStoreOrders();
  } catch (error) {
    infoDiv.innerHTML = `<p class="status error">Error: ${error.message}</p>`;
  }
}

/**
 * Load all orders for selected store
 */
async function loadStoreOrders() {
  try {
    const storeAddr = document.getElementById("storeManageSelect").value;
    if (!storeAddr) return;

    // Get all order IDs for this store from smart contract
    const orderIds = await contract.methods.getStoreOrders(storeAddr).call();

    const storeOrdersList = document.getElementById("storeOrdersList");
    if (!storeOrdersList) return; // Added null check

    if (orderIds.length === 0) {
      storeOrdersList.innerHTML = "<p>No orders</p>";
      return;
    }

    let html = "";
    // Load details for each order
    for (const orderId of orderIds) {
      const order = await contract.methods.orders(orderId).call();
      html += await formatOrderCard(orderId, order, false, false);
    }
    storeOrdersList.innerHTML = html;
  } catch (error) {
    const storeOrdersList = document.getElementById("storeOrdersList");
    if (storeOrdersList)
      storeOrdersList.innerHTML = `<p class="status error">Error: ${error.message}</p>`;
  }
}

/**
 * Filter and display store orders by status
 * @param {number} statusFilter - Order status to filter by (0=Placed, 1=Accepted, 2=ReadyForPickup, etc.)
 */
async function filterStoreOrders(statusFilter) {
  try {
    const storeAddr = document.getElementById("storeManageSelect").value;
    if (!storeAddr) return;

    // Call smart contract function to get orders by status
    // NOTE: Using getStoreOrdersIdsByStatus (not getStoreOrdersByStatus)
    const orderIds = await contract.methods
      .getStoreOrdersIdsByStatus(storeAddr, statusFilter)
      .call();

    const storeOrdersList = document.getElementById("storeOrdersList");
    if (!storeOrdersList) return; // Added null check

    if (orderIds.length === 0) {
      storeOrdersList.innerHTML = `<p>No ${statusNames[statusFilter]} orders</p>`;
      return;
    }

    let html = "";
    for (const orderId of orderIds) {
      const order = await contract.methods.orders(orderId).call();
      html += await formatOrderCard(orderId, order, false, false);
    }
    storeOrdersList.innerHTML = html;
  } catch (error) {
    const storeOrdersList = document.getElementById("storeOrdersList");
    if (storeOrdersList)
      storeOrdersList.innerHTML = `<p class="status error">Error: ${error.message}</p>`;
  }
}

/**
 * Store accepts an incoming order
 */
async function acceptOrder() {
  try {
    const storeManageSelect = document.getElementById("storeManageSelect");
    if (!storeManageSelect)
      return showStatus(
        "storeActionStatus",
        "Store selection element not found",
        "error"
      );
    const storeAddr = storeManageSelect.value;

    const manageOrderId = document.getElementById("manageOrderId");
    if (!manageOrderId)
      return showStatus(
        "storeActionStatus",
        "Order ID input element not found",
        "error"
      );
    const orderId = manageOrderId.value;

    if (!storeAddr || !orderId) {
      return showStatus("storeActionStatus", "Fill in all fields", "error");
    }

    showStatus("storeActionStatus", "Accepting order...", "info");

    // Call smart contract acceptOrder function
    await contract.methods
      .acceptOrder(orderId)
      .send({ from: storeAddr, gas: 3000000 });

    showStatus("storeActionStatus", `Order ${orderId} accepted!`, "success");

    // Reload orders to show updated status
    await loadStoreOrders();
  } catch (error) {
    showStatus("storeActionStatus", `${error.message}`, "error");
  }
}

/**
 * Store marks order as ready for pickup by driver
 */
async function markReady() {
  try {
    const storeManageSelect = document.getElementById("storeManageSelect");
    if (!storeManageSelect)
      return showStatus(
        "storeActionStatus",
        "Store selection element not found",
        "error"
      );
    const storeAddr = storeManageSelect.value;

    const manageOrderId = document.getElementById("manageOrderId");
    if (!manageOrderId)
      return showStatus(
        "storeActionStatus",
        "Order ID input element not found",
        "error"
      );
    const orderId = manageOrderId.value;

    if (!storeAddr || !orderId) {
      return showStatus("storeActionStatus", "Fill in all fields", "error");
    }

    showStatus("storeActionStatus", "Marking ready...", "info");

    // Call smart contract readyForPickup function
    // NOTE: Using readyForPickup (not markReadyForDelivery)
    await contract.methods
      .readyForPickup(orderId)
      .send({ from: storeAddr, gas: 3000000 });

    showStatus("storeActionStatus", `Order ${orderId} ready!`, "success");

    await loadStoreOrders();
  } catch (error) {
    showStatus("storeActionStatus", `${error.message}`, "error");
  }
}

/**
 * Cancel an order (customer or store can cancel)
 */
async function cancelOrder() {
  try {
    const storeManageSelect = document.getElementById("storeManageSelect");
    if (!storeManageSelect)
      return showStatus(
        "storeActionStatus",
        "Store selection element not found",
        "error"
      );
    const storeAddr = storeManageSelect.value;

    const manageOrderId = document.getElementById("manageOrderId");
    if (!manageOrderId)
      return showStatus(
        "storeActionStatus",
        "Order ID input element not found",
        "error"
      );
    const orderId = manageOrderId.value;

    if (!storeAddr || !orderId) {
      return showStatus("storeActionStatus", "Fill in all fields", "error");
    }

    if (!confirm("Cancel this order?")) return;

    showStatus("storeActionStatus", "Cancelling...", "info");

    // Call smart contract cancelOrder function
    await contract.methods
      .cancelOrder(orderId)
      .send({ from: storeAddr, gas: 3000000 });

    showStatus("storeActionStatus", `Order cancelled!`, "success");

    await loadStoreOrders();
  } catch (error) {
    showStatus("storeActionStatus", `${error.message}`, "error");
  }
}

// ==================== DRIVER PANEL ====================

/**
 * Load driver information and available deliveries
 */
async function loadDriverInfo() {
  const driverManageAccount = document.getElementById("driverManageAccount");
  if (!driverManageAccount) return; // Added null check
  const driverAccount = driverManageAccount.value;

  const infoDiv = document.getElementById("driverInfoDisplay");
  if (!infoDiv) return; // Added null check

  if (!driverAccount) {
    infoDiv.innerHTML = "";
    return;
  }

  try {
    // Check if driver is registered on blockchain
    const isRegistered = await contract.methods
      .isDriverRegistered(driverAccount)
      .call();

    if (!isRegistered) {
      infoDiv.innerHTML =
        '<p class="status info">Not registered. Register in "Register Drivers" tab.</p>';
      return;
    }

    // Load driver data from IPFS using address map
    const driverCID = driverAddressMap[driverAccount];

    if (driverCID) {
      const driverData = await getFromIPFS(driverCID);
      infoDiv.innerHTML = `
                <div class="info-card">
                    <h4>${driverData.name}</h4>
                    <p>${driverData.phone} | ${driverData.vehicleType}</p>
                    ${
                      driverData.pictureCID
                        ? `<img src="${getIPFSImageURL(
                            driverData.pictureCID
                          )}" class="ipfs-image">`
                        : ""
                    }
                </div>
            `;
    } else {
      infoDiv.innerHTML = '<p class="status info">Registered.</p>';
    }

    // Auto-load available deliveries
    await loadAvailableDeliveries();
  } catch (error) {
    infoDiv.innerHTML = `<p class="status error">Error: ${error.message}</p>`;
  }
}

/**
 * Load all orders that are ready for pickup (available to drivers)
 */
async function loadAvailableDeliveries() {
  try {
    // Call smart contract function to get orders in ReadyForPickup status
    // NOTE: Using getAvailableOrderIdsForDelivery (not getAvailableDeliveries)
    const orderIds = await contract.methods
      .getAvailableOrderIdsForDelivery()
      .call();

    const availableDeliveriesList = document.getElementById(
      "availableDeliveriesList"
    );
    if (!availableDeliveriesList) return; // Added null check

    if (orderIds.length === 0) {
      availableDeliveriesList.innerHTML = "<p>No deliveries available</p>";
      return;
    }

    let html = "";
    for (const orderId of orderIds) {
      const order = await contract.methods.orders(orderId).call();
      // Show pickup and delivery addresses for drivers
      html += await formatOrderCard(orderId, order, false, true);
    }
    availableDeliveriesList.innerHTML = html;
  } catch (error) {
    const availableDeliveriesList = document.getElementById(
      "availableDeliveriesList"
    );
    if (availableDeliveriesList)
      availableDeliveriesList.innerHTML = `<p class="status error">Error: ${error.message}</p>`;
  }
}

/**
 * Driver picks up an order from store
 */
async function pickupOrder() {
  try {
    const driverManageAccount = document.getElementById("driverManageAccount");
    if (!driverManageAccount)
      return showStatus(
        "driverActionStatus",
        "Driver account selection element not found",
        "error"
      );
    const driverAddr = driverManageAccount.value;

    const driverOrderId = document.getElementById("driverOrderId");
    if (!driverOrderId)
      return showStatus(
        "driverActionStatus",
        "Order ID input element not found",
        "error"
      );
    const orderId = driverOrderId.value;

    if (!driverAddr || !orderId) {
      return showStatus("driverActionStatus", "Fill in all fields", "error");
    }

    showStatus("driverActionStatus", "Picking up order...", "info");

    // Call smart contract pickedUpOrder function
    // NOTE: Using pickedUpOrder (not pickupOrder)
    await contract.methods
      .pickedUpOrder(orderId)
      .send({ from: driverAddr, gas: 3000000 });

    showStatus(
      "driverActionStatus",
      `Order ${orderId} picked up!`,
      "success"
    );

    await loadAvailableDeliveries();
  } catch (error) {
    showStatus("driverActionStatus", `${error.message}`, "error");
  }
}

/**
 * Driver marks order as delivered to customer
 */
async function markDelivered() {
  try {
    const driverAddr = document.getElementById("driverManageAccount").value;
    const orderId = document.getElementById("driverOrderId").value;

    if (!driverAddr || !orderId) {
      return showStatus("driverActionStatus", "Fill in all fields", "error");
    }

    showStatus("driverActionStatus", "Marking as delivered...", "info");

    // Call smart contract orderDelivered function
    // NOTE: Using orderDelivered (not markDelivered)
    await contract.methods
      .orderDelivered(orderId)
      .send({ from: driverAddr, gas: 3000000 });

    showStatus(
      "driverActionStatus",
      `Order ${orderId} delivered!`,
      "success"
    );

    await loadAvailableDeliveries();
  } catch (error) {
    showStatus("driverActionStatus", `${error.message}`, "error");
  }
}

// ==================== FORMAT ORDER CARD ====================

/**
 * Format order information into HTML card
 * @param {number} orderId - Order ID
 * @param {Object} order - Order object from smart contract
 * @param {boolean} showConfirmButton - Whether to show delivery confirmation button (for customers)
 * @param {boolean} showPickupAddress - Whether to show pickup and delivery addresses (for drivers)
 * @returns {Promise<string>} HTML string for order card
 */
async function formatOrderCard(
  orderId,
  order,
  showConfirmButton,
  showPickupAddress = false
) {
  // Get human-readable status name
  const status = statusNames[order.status];

  // Convert Wei amounts back to ETH for display
  const foodTotal = web3.utils.fromWei(order.foodTotal, "ether");
  const totalAmount = web3.utils.fromWei(order.totalAmount, "ether");

  // Get store name and address from IPFS using address map
  let storeName = "Unknown";
  let storeAddress = "";
  const storeCID = storeAddressMap[order.store];
  if (storeCID) {
    try {
      const storeData = await getFromIPFS(storeCID);
      storeName = storeData.name;
      storeAddress = storeData.streetAddress || "Address not specified";
    } catch (e) {
      console.error("Error loading store:", e);
    }
  }

  // Get driver name if assigned using address map
  let driverName = "Not assigned";
  if (order.driver !== "0x0000000000000000000000000000000000000000") {
    const driverCID = driverAddressMap[order.driver];
    if (driverCID) {
      try {
        const driverData = await getFromIPFS(driverCID);
        driverName = driverData.name;
      } catch (e) {
        driverName = order.driver.substring(0, 10) + "...";
      }
    } else {
      driverName = order.driver.substring(0, 10) + "...";
    }
  }

  // Get customer delivery address from IPFS
  let customerAddress = "";
  try {
    for (let i = 0; i < ipfsRegistry.customers.length; i++) {
      const linkedAccount = sessionStorage.getItem(`customer_${i}_account`);
      if (linkedAccount && linkedAccount === order.customer) {
        const customerData = await getFromIPFS(ipfsRegistry.customers[i].cid);
        customerAddress =
          customerData.deliveryAddress || "Address not specified";
        break;
      }
    }
  } catch (e) {
    console.error("Error loading customer:", e);
  }

  // Show confirm delivery button for customers when order status is Delivered (4)
  let confirmButton = "";
  if (showConfirmButton && order.status == 4) {
    confirmButton = `<button onclick="confirmOrderDelivery(${orderId})" style="margin-top:10px;">✅ Confirm Delivery</button>`;
  }

  // Show addresses for drivers (pickup and delivery locations)
  let addressInfo = "";
  if (showPickupAddress) {
    addressInfo = `
            <p><strong>📍 Pickup:</strong> ${storeAddress}</p>
            <p><strong>🏠 Deliver to:</strong> ${customerAddress}</p>
        `;
  }

  // Return formatted HTML card
  return `
        <div class="order-card">
            <h4>Order #${orderId}</h4>
            <p><strong>Store:</strong> ${storeName}</p>
            <p><strong>Driver:</strong> ${driverName}</p>
            ${addressInfo}
            <p><strong>Food Total:</strong> ${foodTotal} ETH</p>
            <p><strong>Total:</strong> ${totalAmount} ETH</p>
            <span class="badge ${status
              .toLowerCase()
              .replace(/\s+/g, "")
              .replace(/[()]/g, "")}">${status}</span>
            ${confirmButton}
        </div>
    `;
}

// ==================== OWNER PANEL ====================

/**
 * Load owner dashboard with contract statistics
 */
async function loadOwnerDashboard() {
  try {
    const ownerAccount = document.getElementById("ownerAccountSelect").value;
    if (!ownerAccount) {
      showStatus("ownerActionStatus", "Select owner account", "error");
      return;
    }

    const contractOwner = await contract.methods.owner().call();
    if (ownerAccount.toLowerCase() !== contractOwner.toLowerCase()) {
      showStatus(
        "ownerActionStatus",
        "Selected account is not the contract owner",
        "error"
      );
      return;
    }

    const dashboardDiv = document.getElementById("ownerDashboard");

    // Get contract data
    const contractBalance = await contract.methods.getContractBalance().call();
    const processingFees = await contract.methods
      .getProcessingFeesCollected()
      .call();
    const orderCounter = await contract.methods.orderCounter().call();

    // Get owner wallet balance
    const ownerBalance = await web3.eth.getBalance(ownerAccount);

    const balanceEth = web3.utils.fromWei(contractBalance, "ether");
    const feesEth = web3.utils.fromWei(processingFees, "ether");
    const ownerBalanceEth = web3.utils.fromWei(ownerBalance, "ether");

    dashboardDiv.innerHTML = `
            <div class="info-card">
                <h4>Contract Overview</h4>
                <p><strong>Owner Wallet Balance:</strong> <span id="ownerWalletBalance">${parseFloat(
                  ownerBalanceEth
                ).toFixed(4)} ETH</span></p>
                <p><strong>Contract Balance:</strong> ${parseFloat(
                  balanceEth
                ).toFixed(4)} ETH</p>
                <p><strong>Processing Fees Available:</strong> ${parseFloat(
                  feesEth
                ).toFixed(4)} ETH</p>
                <p><strong>Total Orders:</strong> ${orderCounter}</p>
                <p><strong>Owner Address:</strong> ${contractOwner}</p>
            </div>
        `;

    // Load platform statistics
    await loadPlatformStats();
  } catch (error) {
    showStatus("ownerActionStatus", `${error.message}`, "error");
  }
}

/**
 * Load platform statistics
 */
async function loadPlatformStats() {
  try {
    const statsDiv = document.getElementById("platformStats");
    const orderCounter = await contract.methods.orderCounter().call();

    let totalOrders = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let activeOrders = 0;
    let totalRevenue = 0;

    // Analyze all orders
    for (let i = 1; i <= orderCounter; i++) {
      try {
        const order = await contract.methods.orders(i).call();
        totalOrders++;

        if (order.status == 5) {
          // Completed
          completedOrders++;
          totalRevenue += parseFloat(
            web3.utils.fromWei(order.processingFee, "ether")
          );
        } else if (order.status == 6) {
          // Cancelled
          cancelledOrders++;
        } else {
          activeOrders++;
        }
      } catch (e) {
        continue;
      }
    }

    // Count registered stores and drivers
    let registeredStores = 0;
    let registeredDrivers = 0;

    for (const account of accounts) {
      try {
        if (await contract.methods.isStoreRegistered(account).call()) {
          registeredStores++;
        }
        if (await contract.methods.isDriverRegistered(account).call()) {
          registeredDrivers++;
        }
      } catch (e) {
        continue;
      }
    }

    statsDiv.innerHTML = `
            <div class="info-card">
                <h4>Platform Statistics</h4>
                <p><strong>Total Orders:</strong> ${totalOrders}</p>
                <p><strong>Completed Orders:</strong> ${completedOrders}</p>
                <p><strong>Active Orders:</strong> ${activeOrders}</p>
                <p><strong>Cancelled Orders:</strong> ${cancelledOrders}</p>
                <p><strong>Total Revenue (Processing Fees):</strong> ${totalRevenue.toFixed(
                  4
                )} ETH</p>
                <p><strong>Registered Stores:</strong> ${registeredStores}</p>
                <p><strong>Registered Drivers:</strong> ${registeredDrivers}</p>
                <p><strong>Completion Rate:</strong> ${
                  totalOrders > 0
                    ? ((completedOrders / totalOrders) * 100).toFixed(1)
                    : 0
                }%</p>
            </div>
        `;
  } catch (error) {
    document.getElementById(
      "platformStats"
    ).innerHTML = `<p class="status error">Error loading stats: ${error.message}</p>`;
  }
}

/**
 * Withdraw processing fees (owner only)
 */
async function withdrawFees() {
  try {
    const ownerAccount = document.getElementById("ownerAccountSelect").value;
    if (!ownerAccount) {
      showStatus("ownerActionStatus", "Select owner account", "error");
      return;
    }

    const contractOwner = await contract.methods.owner().call();
    if (ownerAccount.toLowerCase() !== contractOwner.toLowerCase()) {
      showStatus("ownerActionStatus", "Only owner can withdraw fees", "error");
      return;
    }

    const processingFees = await contract.methods
      .getProcessingFeesCollected()
      .call();
    if (processingFees == 0) {
      showStatus("ownerActionStatus", "No fees to withdraw", "info");
      return;
    }

    const feesEth = web3.utils.fromWei(processingFees, "ether");

    // Get balance before withdrawal
    const balanceBefore = await web3.eth.getBalance(ownerAccount);
    const balanceBeforeEth = parseFloat(
      web3.utils.fromWei(balanceBefore, "ether")
    );

    if (!confirm(`Withdraw ${feesEth} ETH?`)) return;

    showStatus("ownerActionStatus", "Withdrawing fees...", "info");

    await contract.methods.withdrawProcessingFees().send({
      from: ownerAccount,
      gas: 3000000,
    });

    // Get balance after withdrawal
    const balanceAfter = await web3.eth.getBalance(ownerAccount);
    const balanceAfterEth = parseFloat(
      web3.utils.fromWei(balanceAfter, "ether")
    );

    // Calculate difference (accounting for gas fees)
    const difference = balanceAfterEth - balanceBeforeEth;

    showStatus(
      "ownerActionStatus",
      `Fees withdrawn! Balance increased by ${difference.toFixed(
        4
      )} ETH (minus gas fees)`,
      "success"
    );

    // Update wallet balance display
    const balanceSpan = document.getElementById("ownerWalletBalance");
    if (balanceSpan) {
      balanceSpan.textContent = `${balanceAfterEth.toFixed(4)} ETH`;
    }

    // Reload dashboard
    await loadOwnerDashboard();
  } catch (error) {
    showStatus("ownerActionStatus", `${error.message}`, "error");
  }
}