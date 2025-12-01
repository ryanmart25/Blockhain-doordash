// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MealDispatchDApp {
	
	// Enums for order states 
	enum OrderState {
		Placed,
		Accepted,
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

	// *********** Mappings to store entities and orders ***********

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

	// ***************** events *******************
	event OrderPlaced(address indexed customer, address indexed store, uint indexed orderId, uint totalAmount, uint processingFee);
	event OrderStateChanged(uint indexed orderId, OrderState status);
	//event OrderAccepted(address indexed store, uint indexed orderId);
	//event OrderDelivered(address indexed driver, uint indexed orderId);
	//event OrderCompleted(address indexed customer, uint indexed orderId);	
	event StoreRegistered(address indexed storeAddress);
	//event CustomerRegistered(string customerName, address indexed accountAddress);
	event DriverRegistered(address indexed driverAddress);
	event PaymentReceived(address indexed from, address indexed to, uint amount);
	//event ProcessingFeeWithdrawn(address indexed owner, uint amount);
	// envent withdrawn amount and contract balance
	event ProcessingFeeWithdrawn(address indexed owner, uint amount, uint contractBalance);

	// ***************** Modifiers *******************
	// make sure only owner can call withdraw function
	modifier onlyOwner() {
		require(msg.sender == owner, "Only owner can call this function");
		_; // continue executing the rest of the function
	}

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

	// ***************** functions *******************

	// register store function
	function registerStore() external {

		//validate store is not already registered
		require(storesIsRegistered[msg.sender] == false, "Store is already registered");
		storesIsRegistered[msg.sender] = true;
		emit StoreRegistered(msg.sender);
	}

	// register driver function
	function registerDriver() external {

		//validate driver is not already registered
		require(driversIsRegistered[msg.sender] == false, "Driver is already registered");
		driversIsRegistered[msg.sender] = true;
		emit DriverRegistered(msg.sender);
	}

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

		// update total processing fees collected+++++++++++++++++check later
		//totalProcessingFeesCollected += _processingFee;

		// emit event
		emit OrderPlaced(msg.sender, _storeAddress, orderCounter, _totalAmount,_processingFee);
		emit OrderStateChanged(orderCounter, orders[orderCounter].status);

		return orderCounter;
	}

	// accept order function
	function acceptOrder(uint _orderId) external {

		Order storage order = orders[_orderId];

		// validate store is registered
		require(storesIsRegistered[msg.sender], "Store is not registered");

		// validate order is in Placed state
		require(order.status == OrderState.Placed, "Order is not in Placed state");

		// validate msg.sender is the store for the order
		require(order.store == msg.sender, "Order does not belong to this store");

		// validate orderId is valid
		require(_orderId > 0 && _orderId <= orderCounter, "Invalid order ID");
		
		// update order status to Accepted
		order.status = OrderState.Accepted;

		// emit event
		emit OrderStateChanged(_orderId, order.status);
	}

	// cancel order
	function cancelOrder(uint _orderId) external {
		// get order
		Order storage order = orders[_orderId];

		// validate order is not accepted yet
		require(order.status == OrderState.Placed, "Order cannot be canceled at this stage");

		// validate msg.sender is the customer who placed the order or the store can cancel the order 
		require(order.customer == msg.sender || order.store == msg.sender, "Not authorized to cancel this order");

		// validate orderId is valid
		require(_orderId > 0 && _orderId <= orderCounter, "Invalid order ID");

		// update order status to Canceled
		order.status = OrderState.Canceled;

		// define who is responsible for system fees on cancellation
		uint refundAmount = order.totalAmount - ((order.processingFee)/2);

		// refund 
		if (msg.sender == order.customer) {
			// if customer cancels they incur half the processing fee
			payable(order.customer).transfer(refundAmount);
			totalProcessingFeesCollected += (order.processingFee)/2;
			//payable(owner).transfer((order.processingFee)/2);
		} else if (msg.sender == order.store) {
			payable(order.customer).transfer(order.totalAmount);
			// store cancelation does not incur a processing fee in the current model
			// in future system will have cancellation fees for stores by forcing them to deposite a small amount when registering if a store cancels more then deposited amount they will be removed from registerd stores and have to re-register for accepting orders. In this case the store will loose all not accepted orders and customers will be refunded in full.
		}

		// emit event
		emit OrderStateChanged(_orderId, order.status);
	}

	// mark order ready for pickup
	function readyForPickup(uint _orderId) external {

		// get order
		Order storage order = orders[_orderId];

		// validate store is registered
		require(storesIsRegistered[msg.sender], "Store is not registered");

		// validate order is in Placed state
		require(order.status == OrderState.Accepted, "Order is not in Accepted state");

		// validate msg.sender is the store for the order
		require(order.store == msg.sender, "Order does not belong to this store");

		// validate orderId is valid
		require(_orderId > 0 && _orderId <= orderCounter, "Invalid order ID");

		// update order status to ReadyForPickup
		order.status = OrderState.ReadyForPickup;

		//emit event
		emit OrderStateChanged(_orderId, order.status);
    }
	
  
	// pick up order
	function pickedUpOrder(uint _orderId) external {

		// get order
		Order storage order = orders[_orderId];

		// validate driver is registered
		require(driversIsRegistered[msg.sender], "Driver is not registered");

		// validate order is in ReadyForPickup state
		require(order.status == OrderState.ReadyForPickup, "Order is not in ReadyForPickup state");

		// validate orderId is valid
		require(_orderId > 0 && _orderId <= orderCounter, "Invalid order ID");

		// validate order does not have a driver assigned yet
		require(order.driver == address(0), "Order already has a driver assigned");

		// assign driver to order
		order.driver = msg.sender;

		// add order to driver order list
		driverOrders[msg.sender].push(_orderId);

		// update order status to OnDelivery
		order.status = OrderState.OnDelivery;

		// emit event
		emit OrderStateChanged(_orderId, order.status);
	}

	// deliver order
	function orderDelivered(uint _orderId) external {
		// get order
		Order storage order = orders[_orderId];

		// validate driver is registered
		require(driversIsRegistered[msg.sender], "Driver is not registered");

		// validate order is in OnDelivery state
		require(order.status == OrderState.OnDelivery, "Order is not in OnDelivery state");

		// validate orderId is valid
		require(_orderId > 0 && _orderId <= orderCounter, "Invalid order ID");

		// validate msg.sender is the driver for the order
		require(order.driver == msg.sender, "Order does not belong to this driver");

		// update order status to Delivered
		order.status = OrderState.Delivered;

		// emit event
		emit OrderStateChanged(_orderId, order.status);
	}

	// complete order
	function confirmOrderDelivered(uint _orderId) external {
		// get order
		Order storage order = orders[_orderId];

		// validate order is in Delivered state
		require(order.status == OrderState.Delivered, "Order is not in Delivered state");

		// validate orderId is valid
		require(_orderId > 0 && _orderId <= orderCounter, "Invalid order ID");

		// validate msg.sender is the customer for the order
		require(order.customer == msg.sender, "Order does not belong to this customer");

		// update order status to Completed
		order.status = OrderState.Completed;

		// distribute payments
		payable(order.store).transfer(order.foodTotal + order.foodTip);
		payable(order.driver).transfer(order.deliveryFee + order.deliveryTip);
		totalProcessingFeesCollected += order.processingFee;
		//payable(owner).transfer(order.processingFee);

		// emit event
		emit PaymentReceived(msg.sender, order.store, order.foodTotal + order.foodTip);
		emit PaymentReceived(msg.sender, order.driver, order.deliveryFee + order.deliveryTip);
		emit OrderStateChanged(_orderId, order.status);
	}

	// owner withdraw processing fees only owner can call
	function withdrawProcessingFees() external onlyOwner {
		// validate msg.sender is owner
		require(msg.sender == owner, "Only owner can withdraw processing fees");

		// validate there are processing fees to withdraw
		require(totalProcessingFeesCollected > 0, "No processing fees to withdraw");

		uint amount = totalProcessingFeesCollected;
		totalProcessingFeesCollected = 0;

		// transfer processing fees to owner
		payable(owner).transfer(amount);

		// emit event
		emit ProcessingFeeWithdrawn(owner, amount, address(this).balance);
	}

	// ************** view functions **************

	//check store registration
	function isStoreRegistered(address _storeAddress) external view returns (bool) {
		return storesIsRegistered[_storeAddress];
	}

	// check driver registration
	function isDriverRegistered(address _driverAddress) external view returns (bool) {
		return driversIsRegistered[_driverAddress];
	}

	//check store orders
	function getStoreOrders(address _storeAddress) external view returns (uint[] memory) {
		return storeOrders[_storeAddress];
	}

	// check customer orders
	function getCustomerOrders(address _customerAddress) external view returns (uint[] memory) {
		return customerOrders[_customerAddress];
	}

	// check available orders for delivery
	function getAvailableOrderIdsForDelivery() external view returns (uint[] memory) {
		// count matching orders to allocate fixed-size memory array
		uint count = 0;
		for (uint i = 1; i <= orderCounter; i++) {
			if (orders[i].status == OrderState.ReadyForPickup) {
				count++;
			}
		}
		uint[] memory tempOrderIds = new uint[](count);
		uint idx = 0;
		for (uint i = 1; i <= orderCounter; i++) {
			if (orders[i].status == OrderState.ReadyForPickup) {
				tempOrderIds[idx] = i;
				idx++;
			}
		}
		return tempOrderIds;
	}


	// check store orders by status
	function getStoreOrdersIdsByStatus(address _storeAddress, OrderState _orderState) external view returns (uint[] memory) {

		// get the store order Ids
		// allOrderIds contains all order IDs for the given store
		uint[] memory allOrderIds = storeOrders[_storeAddress];
		
		// check all the store orders (that you have the id of them) state and if the state matches add to array
		// first find the size of the result array.
		uint count = 0;
		for (uint i = 0; i < allOrderIds.length; i++) {
			if (orders[allOrderIds[i]].status == _orderState) {
				count++;
			}
		}

		uint[] memory result = new uint[](count);
		uint idx = 0;

		for (uint i = 0; i < allOrderIds.length; i++) {
			if (orders[allOrderIds[i]].status == _orderState) {
				result[idx] = allOrderIds[i];
				idx++;
			}
		}	
		return result;
	}

	// check contract balance
	function getContractBalance() external view returns (uint) {
		return address(this).balance;
	}

	// check processing fees collected
	function getProcessingFeesCollected() external view returns (uint) {
		return totalProcessingFeesCollected;
	}

}