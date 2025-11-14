// app.js
import abi from './abi.json' assert { type: 'json' };

// paste your deployed address here (or enter in UI)
let CONTRACT_ADDRESS = '0xe1293443887FBAE508a06e00A38D4964A066D865';

const STATUS = ["Placed","Accepted","ReadyForPickup","OnDelivery","Delivered","Completed","Canceled"];

// state
let web3, accounts = [], contract;

// dom helpers
const $ = (id) => document.getElementById(id);
const set = (id, text) => { $(id).textContent = text; };
const setHTML = (el, html) => { el.innerHTML = html; };
// Tabs: .tab buttons switch .tabpanel sections by data-tab -> #id
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tabpanel');

  function activate(name) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    panels.forEach(p => p.classList.toggle('active', p.id === name));
  }

  tabs.forEach(t => t.addEventListener('click', () => activate(t.dataset.tab)));

  // initial state (defaults to 'customer' if none marked active)
  const initial = document.querySelector('.tab.active')?.dataset.tab || 'customer';
  activate(initial);
}

// dom needs to exist before i try to do document queries
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTabs);
} else {
  initTabs();
}

// tabs
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tabpanel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

function setStatus(msg) { set('status', msg); }
function logEvent(obj) {
  const prev = $('events').textContent || "";
  $('events').textContent = JSON.stringify(obj, null, 2) + "\n" + prev;
}
const isAddr = (a) => /^0x[a-fA-F0-9]{40}$/.test(a);

function asWei(n) { try { return BigInt(n || 0); } catch { return 0n; } }
function sumWei(...xs) { return xs.reduce((a,b)=>a+asWei(b), 0n); }

async function ensureConnected() {
  if (!window.ethereum) throw new Error('Install MetaMask');
  if (!accounts.length) {
    accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    web3 = new Web3(window.ethereum);
    set('acct', accounts[0]);
    const chainId = await web3.eth.getChainId();
    set('net', `chainId ${chainId}`);
    window.ethereum.on('accountsChanged', (accs) => { accounts = accs; set('acct', accounts[0] || 'Not connected'); });
    window.ethereum.on('chainChanged', () => window.location.reload());
  }
}

async function loadContract() {
  CONTRACT_ADDRESS = $('contractAddr').value.trim();
  if (!isAddr(CONTRACT_ADDRESS)) throw new Error('Invalid contract address');
  contract = new web3.eth.Contract(abi, CONTRACT_ADDRESS);
  subscribeEvents();
  await refreshGlobals();
  await refreshBadges();
}

// globals
async function refreshGlobals() {
  try {
    const [own, oc, bal, fees] = await Promise.all([
      contract.methods.owner().call(),
      contract.methods.orderCounter().call(),
      contract.methods.getContractBalance().call(),
      contract.methods.getProcessingFeesCollected().call(),
    ]);
    set('ownerAddr', own);
    set('orderCounter', String(oc));
    set('contractBal', `${bal} wei`);
    set('feesCollected', `${fees} wei`);
  } catch (e) { setStatus(e.message); }
}

// events
function subscribeEvents() {
  try {
    contract.events.OrderPlaced({ fromBlock: "latest" })
      .on("data", (ev) => logEvent({ OrderPlaced: ev.returnValues }))
    contract.events.OrderStateChanged({ fromBlock: "latest" })
      .on("data", (ev) => logEvent({ OrderStateChanged: ev.returnValues }))
    contract.events.StoreRegistered({ fromBlock: "latest" })
      .on("data", (ev) => logEvent({ StoreRegistered: ev.returnValues }))
    contract.events.DriverRegistered({ fromBlock: "latest" })
      .on("data", (ev) => logEvent({ DriverRegistered: ev.returnValues }))
    contract.events.PaymentReceived({ fromBlock: "latest" })
      .on("data", (ev) => logEvent({ PaymentReceived: ev.returnValues }))
    contract.events.ProcessingFeeWithdrawn({ fromBlock: "latest" })
      .on("data", (ev) => logEvent({ ProcessingFeeWithdrawn: ev.returnValues }))
  } catch (_) { /* ignore */ }
}

// general UI wiring
$('connectBtn').addEventListener('click', async () => { try { await ensureConnected(); setStatus('connected'); } catch(e){ setStatus(e.message);} });
$('loadContractBtn').addEventListener('click', async () => { try { await ensureConnected(); await loadContract(); setStatus('contract loaded'); } catch(e){ setStatus(e.message);} });
$('refreshGlobalsBtn').addEventListener('click', refreshGlobals);
$('inspectOrderBtn').addEventListener('click', async () => {
  try {
    const id = Number($('inspectOrderId').value || 0);
    if (!id) throw new Error('enter a valid orderId');
    const o = await contract.methods.orders(id).call();
    o.statusName = STATUS[Number(o.status)] || String(o.status);
    $('inspectOrderJson').textContent = JSON.stringify(o, null, 2);
  } catch(e){ setStatus(e.message); }
});

// role badges
async function refreshBadges() {
  if (!contract || !accounts.length) return;
  try {
    const [s, d] = await Promise.all([
      contract.methods.isStoreRegistered(accounts[0]).call(),
      contract.methods.isDriverRegistered(accounts[0]).call(),
    ]);
    const storeTag = $('storeRegState');
    storeTag.textContent = s ? 'registered' : 'not registered';
    storeTag.className = `pill ${s ? 'ok' : 'warn'}`;
    const driverTag = $('driverRegState');
    driverTag.textContent = d ? 'registered' : 'not registered';
    driverTag.className = `pill ${d ? 'ok' : 'warn'}`;
  } catch {}
}

/////////////////////////////
// CUSTOMER: menus and cart
/////////////////////////////

// menus are off-chain and per store address
const Menu = {
  key(addr){ return `menu:${addr.toLowerCase()}`; },
  load(addr){ try { return JSON.parse(localStorage.getItem(this.key(addr)) || '[]'); } catch { return []; } },
  save(addr, items){ localStorage.setItem(this.key(addr), JSON.stringify(items)); }
};

const Cart = {
  key(addr, store){ return `cart:${addr.toLowerCase()}:${store.toLowerCase()}`; },
  load(addr, store){ try { return JSON.parse(localStorage.getItem(this.key(addr,store)) || '[]'); } catch { return []; } },
  save(addr, store, rows){ localStorage.setItem(this.key(addr,store), JSON.stringify(rows)); },
  clear(addr, store){ localStorage.removeItem(this.key(addr,store)); }
};

let currentCustomerStore = '';
let cartRows = [];

$('loadMenuBtn').addEventListener('click', async () => {
  try {
    await ensureConnected();
    const store = $('customerStoreAddr').value.trim();
    if (!isAddr(store)) throw new Error('enter a valid store address');
    currentCustomerStore = store;
    renderMenu(store);
    cartRows = Cart.load(accounts[0], store);
    renderCart();
  } catch(e){ setStatus(e.message); }
});

function renderMenu(store) {
  const items = Menu.load(store);
  if (!items.length) {
    setHTML($('menuList'),
      `<div class="muted">No menu yet for this store. Ask the owner to create one in the Restaurant Owner tab.</div>`);
    return;
  }
  const html = items.map((it, idx) => `
    <div class="menu-item">
      <div>
        <div>${it.name}</div>
        <div class="muted mono">${it.price} wei</div>
      </div>
      <div>
        <button data-idx="${idx}" class="addToCartBtn">Add</button>
      </div>
    </div>
  `).join('');
  setHTML($('menuList'), html);
  document.querySelectorAll('.addToCartBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.idx);
      const items = Menu.load(store);
      const item = items[i];
      const found = cartRows.find(r => r.name === item.name && r.price === item.price);
      if (found) found.qty += 1; else cartRows.push({ name:item.name, price:item.price, qty:1 });
      Cart.save(accounts[0], store, cartRows);
      renderCart();
    });
  });
}

function renderCart() {
  if (!currentCustomerStore) return;
  if (!cartRows.length) {
    setHTML($('cartList'), `<div class="muted">Cart is empty</div>`);
  } else {
    setHTML($('cartList'), cartRows.map((r, idx) => `
      <div class="cart-row">
        <div>
          <div>${r.name} × ${r.qty}</div>
          <div class="muted mono">${r.price} wei each</div>
        </div>
        <div class="row">
          <span class="mono">${(asWei(r.price)*BigInt(r.qty)).toString()} wei</span>
          <button data-i="${idx}" class="decBtn">−</button>
          <button data-i="${idx}" class="incBtn">+</button>
          <button data-i="${idx}" class="rmBtn">Remove</button>
        </div>
      </div>
    `).join(''));
    document.querySelectorAll('.decBtn').forEach(b=>b.addEventListener('click',()=>{ const i=Number(b.dataset.i); if(cartRows[i].qty>1) cartRows[i].qty--; else cartRows.splice(i,1); Cart.save(accounts[0], currentCustomerStore, cartRows); renderCart(); }));
    document.querySelectorAll('.incBtn').forEach(b=>b.addEventListener('click',()=>{ const i=Number(b.dataset.i); cartRows[i].qty++; Cart.save(accounts[0], currentCustomerStore, cartRows); renderCart(); }));
    document.querySelectorAll('.rmBtn').forEach(b=>b.addEventListener('click',()=>{ const i=Number(b.dataset.i); cartRows.splice(i,1); Cart.save(accounts[0], currentCustomerStore, cartRows); renderCart(); }));
  }
  const subtotal = cartRows.reduce((a,r)=>a + asWei(r.price)*BigInt(r.qty), 0n);
  set('cartSubtotal', subtotal.toString());
  recomputeTotal();
}

$('clearCartBtn').addEventListener('click', () => {
  cartRows = [];
  if (currentCustomerStore && accounts[0]) Cart.clear(accounts[0], currentCustomerStore);
  renderCart();
});

['tipRestaurant','tipDriver','deliveryFee','processingFee'].forEach(id => {
  $(id).addEventListener('input', recomputeTotal);
});

function recomputeTotal() {
  const subtotal = asWei($('cartSubtotal').textContent);
  const tipR = asWei($('tipRestaurant').value);
  const tipD = asWei($('tipDriver').value);
  const dFee = asWei($('deliveryFee').value);
  const pFee = asWei($('processingFee').value);
  const total = subtotal + tipR + dFee + tipD + pFee;
  set('cartTotal', total.toString());
}

$('checkoutBtn').addEventListener('click', async () => {
  try {
    await ensureConnected();
    if (!contract) throw new Error('load contract first');
    if (!currentCustomerStore) throw new Error('select a restaurant');
    if (!cartRows.length) throw new Error('cart is empty');

    const foodTotal = asWei($('cartSubtotal').textContent).toString();
    const foodTip = asWei($('tipRestaurant').value).toString();
    const deliveryFee = asWei($('deliveryFee').value).toString();
    const deliveryTip = asWei($('tipDriver').value).toString();
    const processingFee = asWei($('processingFee').value).toString();
    const msgValue = (sumWei(foodTotal, foodTip, deliveryFee, deliveryTip, processingFee)).toString();

    setStatus('sending placeOrder...');
    const tx = await contract.methods.placeOrder(
      currentCustomerStore,
      foodTotal, foodTip, deliveryFee, deliveryTip, processingFee
    ).send({ from: accounts[0], value: msgValue });

    const ev = tx.events?.OrderPlaced?.returnValues;
    $('checkoutMsg').textContent = ev ? `Order placed successfully. orderId ${ev.orderId}` : 'Order placed successfully.';
    setStatus(`placed in block ${tx.blockNumber}`);

    // optional: clear cart after success
    cartRows = [];
    Cart.clear(accounts[0], currentCustomerStore);
    renderCart();
    await refreshMyOrders();
    await refreshGlobals();
  } catch(e){ setStatus(e.message); }
});

$('refreshMyOrdersBtn').addEventListener('click', refreshMyOrders);
async function refreshMyOrders() {
  try {
    await ensureConnected();
    if (!contract) return;
    const ids = await contract.methods.getCustomerOrders(accounts[0]).call();
    const cards = await Promise.all(ids.map(async id => {
      const o = await contract.methods.orders(id).call();
      const st = STATUS[Number(o.status)] || String(o.status);
      return `
        <div class="order-row">
          <div>
            <div>#${id} • ${st}</div>
            <div class="muted mono">store ${o.store}</div>
            <div class="muted mono">driver ${o.driver}</div>
          </div>
          <div>
            <div class="mono badge">foodTotal ${o.foodTotal}</div>
            <div class="mono badge">tips r:${o.foodTip} d:${o.deliveryTip}</div>
            <div class="mono badge">deliveryFee ${o.deliveryFee}</div>
          </div>
        </div>`;
    }));
    setHTML($('myOrders'), cards.join('') || `<div class="muted">No orders yet.</div>`);
  } catch(e){ setStatus(e.message); }
}

////////////////////////////////////////
// RESTAURANT OWNER: registration/menu
////////////////////////////////////////

$('registerStoreBtn').addEventListener('click', async () => {
  try {
    await ensureConnected();
    const tx = await contract.methods.registerStore().send({ from: accounts[0] });
    setStatus(`store registered in block ${tx.blockNumber}`);
    await refreshBadges();
  } catch(e){ setStatus(e.message); }
});

$('loadOwnerMenuBtn').addEventListener('click', () => {
  const a = $('ownerStoreAddr').value.trim();
  if (!isAddr(a)) { setStatus('enter a valid store address'); return; }
  renderOwnerMenu(a);
});

$('addMenuItemBtn').addEventListener('click', () => {
  const addr = $('ownerStoreAddr').value.trim();
  if (!isAddr(addr)) { setStatus('enter your store address'); return; }
  const name = $('menuItemName').value.trim();
  const price = $('menuItemPrice').value.trim();
  if (!name || !price) { setStatus('enter name and price'); return; }
  const items = Menu.load(addr);
  items.push({ name, price });
  Menu.save(addr, items);
  $('menuItemName').value = ''; $('menuItemPrice').value = '';
  renderOwnerMenu(addr);
});

$('saveMenuBtn').addEventListener('click', () => {
  const addr = $('ownerStoreAddr').value.trim();
  if (!isAddr(addr)) { setStatus('enter your store address'); return; }
  setStatus('menu saved');
});

function renderOwnerMenu(addr) {
  const items = Menu.load(addr);
  if (!items.length) {
    setHTML($('ownerMenuList'), `<div class="muted">No items yet.</div>`);
    return;
  }
  setHTML($('ownerMenuList'), items.map((it, i) => `
    <div class="menu-row">
      <div>
        <div>${it.name}</div>
        <div class="muted mono">${it.price} wei</div>
      </div>
      <div class="row">
        <button data-i="${i}" class="editItemBtn">Edit</button>
        <button data-i="${i}" class="delItemBtn">Delete</button>
      </div>
    </div>
  `).join(''));
  document.querySelectorAll('.delItemBtn').forEach(b => b.addEventListener('click', () => {
    const i = Number(b.dataset.i); const items = Menu.load(addr); items.splice(i,1); Menu.save(addr, items); renderOwnerMenu(addr);
  }));
  document.querySelectorAll('.editItemBtn').forEach(b => b.addEventListener('click', () => {
    const i = Number(b.dataset.i); const items = Menu.load(addr);
    const newName = prompt('New name', items[i].name) ?? items[i].name;
    const newPrice = prompt('New price wei', items[i].price) ?? items[i].price;
    items[i] = { name:newName, price:newPrice };
    Menu.save(addr, items); renderOwnerMenu(addr);
  }));
}

// store order lists by status
const storeStatusBtns = [
  ['storeOrdersPlacedBtn', 0],
  ['storeOrdersAcceptedBtn', 1],
  ['storeOrdersReadyBtn', 2],
  ['storeOrdersOnDeliveryBtn', 3],
  ['storeOrdersDeliveredBtn', 4],
  ['storeOrdersCompletedBtn', 5],
  ['storeOrdersCanceledBtn', 6],
];
storeStatusBtns.forEach(([id, st]) => {
  $(id).addEventListener('click', async () => {
    try {
      await ensureConnected();
      const ids = await contract.methods.getStoreOrdersIdsByStatus(accounts[0], st).call();
      const rows = await Promise.all(ids.map(async (oid) => {
        const o = await contract.methods.orders(oid).call();
        return `
          <div class="order-row">
            <div>
              <div>#${oid} • ${STATUS[Number(o.status)]}</div>
              <div class="muted mono">customer ${o.customer}</div>
              <div class="muted mono">driver ${o.driver}</div>
            </div>
            <div class="order-actions">
              <button data-oid="${oid}" class="inspectBtn">Inspect</button>
            </div>
          </div>`;
      }));
      setHTML($('storeOrders'), rows.join('') || `<div class="muted">No orders in this status.</div>`);
      document.querySelectorAll('.inspectBtn').forEach(btn => btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.oid);
        const o = await contract.methods.orders(id).call();
        o.statusName = STATUS[Number(o.status)];
        alert(`Order #${id}\n\nstore: ${o.store}\ncustomer: ${o.customer}\ndriver: ${o.driver}\nfoodTotal: ${o.foodTotal}\nfoodTip: ${o.foodTip}\ndeliveryFee: ${o.deliveryFee}\ndeliveryTip: ${o.deliveryTip}\nprocessingFee: ${o.processingFee}\nstatus: ${o.statusName}`);
      }));
    } catch(e){ setStatus(e.message); }
  });
});

// store order actions
$('acceptBtn').addEventListener('click', async () => {
  try {
    await ensureConnected();
    const id = Number($('actAcceptId').value || 0);
    if (!id) throw new Error('enter orderId');
    const tx = await contract.methods.acceptOrder(id).send({ from: accounts[0] });
    setStatus(`accepted in block ${tx.blockNumber}`);
  } catch(e){ setStatus(e.message); }
});
$('readyBtn').addEventListener('click', async () => {
  try {
    await ensureConnected();
    const id = Number($('actReadyId').value || 0);
    if (!id) throw new Error('enter orderId');
    const tx = await contract.methods.readyForPickup(id).send({ from: accounts[0] });
    setStatus(`ready in block ${tx.blockNumber}`);
  } catch(e){ setStatus(e.message); }
});
$('storeCancelBtn').addEventListener('click', async () => {
  try {
    await ensureConnected();
    const id = Number($('actCancelId').value || 0);
    if (!id) throw new Error('enter orderId');
    const tx = await contract.methods.cancelOrder(id).send({ from: accounts[0] });
    setStatus(`canceled in block ${tx.blockNumber}`);
  } catch(e){ setStatus(e.message); }
});

////////////////////////
// DRIVER
////////////////////////

$('registerDriverBtn').addEventListener('click', async () => {
  try {
    await ensureConnected();
    const tx = await contract.methods.registerDriver().send({ from: accounts[0] });
    setStatus(`driver registered in block ${tx.blockNumber}`);
    await refreshBadges();
  } catch(e){ setStatus(e.message); }
});

$('refreshAvailableBtn').addEventListener('click', refreshAvailable);
async function refreshAvailable() {
  try {
    await ensureConnected();
    const ids = await contract.methods.getAvailableOrderIdsForDelivery().call();
    const rows = await Promise.all(ids.map(async id => {
      const o = await contract.methods.orders(id).call();
      return `
        <div class="order-row">
          <div>
            <div>#${id} • ${STATUS[Number(o.status)]}</div>
            <div class="muted mono">restaurant ${o.store}</div>
            <div class="muted mono">customer ${o.customer}</div>
          </div>
          <div>
            <div class="badge mono">deliveryFee ${o.deliveryFee}</div>
            <div class="badge mono">tip ${o.deliveryTip}</div>
          </div>
        </div>
      `;
    }));
    setHTML($('availableOrders'), rows.join('') || `<div class="muted">No available deliveries.</div>`);
  } catch(e){ setStatus(e.message); }
}

$('pickupBtn').addEventListener('click', async () => {
  try {
    await ensureConnected();
    const id = Number($('pickupOrderId').value || 0);
    if (!id) throw new Error('enter orderId');
    const tx = await contract.methods.pickedUpOrder(id).send({ from: accounts[0] });
    setStatus(`picked up in block ${tx.blockNumber}`);
    await refreshAvailable();
  } catch(e){ setStatus(e.message); }
});

$('deliveredBtn').addEventListener('click', async () => {
  try {
    await ensureConnected();
    const id = Number($('deliveredOrderId').value || 0);
    if (!id) throw new Error('enter orderId');
    const tx = await contract.methods.orderDelivered(id).send({ from: accounts[0] });
    setStatus(`delivered in block ${tx.blockNumber}`);
  } catch(e){ setStatus(e.message); }
});

// customer final confirmation shortcut for testing
$('customerConfirmBtn').addEventListener('click', async () => {
  try {
    await ensureConnected();
    const id = Number($('customerConfirmId').value || 0);
    if (!id) throw new Error('enter orderId');
    const tx = await contract.methods.confirmOrderDelivered(id).send({ from: accounts[0] });
    setStatus(`completed in block ${tx.blockNumber}`);
    await refreshGlobals();
  } catch(e){ setStatus(e.message); }
});
