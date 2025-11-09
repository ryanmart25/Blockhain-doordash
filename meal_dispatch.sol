// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

contract MealDispatchDApp {
	
	// Enums for order states 
	enum OrderState {
		Placed,
		Accepted,
		Cancel,
		ReadyForPickup,
		OnDelivery,	
		Delivered,
		Completed,
		Canceled
	}

	// Structs for Store, Customer, Driver, and Order
	//struct Store {
	//string name;
	//	address accountAddress;
	//}

	//struct Customer {
		//string name;
		//address accountAddress;
	//}

	//struct Driver {
		//string name;
		//address accountAddress;
	//}

	struct Order {
		address customer;
		address store;
		address driver;
		uint foodTotal;
		uint foodTip;
		uint deliveryFee;
		uint deliveryTip;
		uint processingFee;
		uint totalAmount;
		OrderState status;
	}

	// platform owner who receives processing fees
	address public owner;

	// Mappings to store entities and orders

	//  storeAddress => isRegistered
	mapping(address => bool) public storesIsRegistered;

	//  driverAddress => isRegistered
	mapping(address => bool) public driversIsRegistered;

	//  orderId => Order struct
	mapping(uint => Order) public orders;

	// Mapping to store orders by order ID (orderId => Order struct)
	//mapping(uint => Order) public Orders;

	// Mapping to track which Ethereum address is used
	//mapping(address => bool) public addressUsed;

	// keep track of orders(order Ids) for each customer, store, and driver
	mapping(address => uint[]) public customerOrders;
	mapping(address => uint[]) public driverOrders;
	mapping(address => uint[]) public storeOrders;

	// events
	event OrderPlaced(address indexed customer, address indexed store, uint indexed orderId, uint totalAmount, uint processingFee);
	event OrderStateChanged(uint indexed orderId, OrderState status);
	//event OrderAccepted(address indexed store, uint indexed orderId);
	//event OrderDelivered(address indexed driver, uint indexed orderId);
	//event OrderCompleted(address indexed customer, uint indexed orderId);	
	event StoreRegistered(address indexed storeAddress);
	//event CustomerRegistered(string customerName, address indexed accountAddress);
	event DriverRegistered(address indexed driverAddress);
	//event PaymentReceived(address indexed from, uint amount);
	event ProcessingFeeWithdrawn(address indexed owner, uint amount);

	// order conunter
	uint public  orderCounter;

	// track total fees collected
	uint public totalProcessingFeesCollected;

	// constructor runs when the contract is deployed - customer, store, driver registrations could go here
	constructor() {
		orderCounter = 0;
		owner = msg.sender;
		totalProcessingFeesCollected = 0;
	}

	// *****************functions*******************

	// register store function
	function registerStore() external {}

	// register driver function
	function registerDriver() external {}

	// place order function
	function placeOrder(
		address _storeAddress,
		uint _foodTotal,
		uint _foodTip,
		uint _deliveryFee,
		uint _deliveryTip,
		uint _processingFee
		) external payable returns (uint) {

		// validate store is registered
		require(storesIsRegistered[_storeAddress], "Store is not registered");

		// validate payment amount
		uint _totalAmount = _foodTotal + _foodTip + _deliveryFee + _deliveryTip + _processingFee;
		require(msg.value == _totalAmount, "Insufficient payment for order");

		orderCounter++;

		// create order
		orders[orderCounter] = Order({
			customer: msg.sender,
			store: _storeAddress,
			driver: address(0),
			foodTotal: _foodTotal,
			foodTip: _foodTip,
			deliveryFee: _deliveryFee,
			deliveryTip: _deliveryTip,
			processingFee: _processingFee,
			totalAmount: _totalAmount,
			status: OrderState.Placed
		});

		// add order to customer and store order lists
		customerOrders[msg.sender].push(orderCounter);
		storeOrders[_storeAddress].push(orderCounter);

		// update total processing fees collected
		totalProcessingFeesCollected += _processingFee;

		// emit event
		emit OrderPlaced(msg.sender, _storeAddress, orderCounter, _totalAmount,_processingFee);
		emit OrderStateChanged(orderCounter, orders[orderCounter].status);

		return orderCounter;
	}

	// accept order
	function acceptOrder() external {

	}

	// cancel order
	function cancelOrder() external {}

	// mark order ready for pickup
	function readyForPickup() external {}
  
	// pick up order
	function pickedUpOrder() external {}

	// deliver order
	function orderDelivered() external {}

	// complete order
	function completeOrder() external {}
}