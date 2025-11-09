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
	mapping(address => bool) public stores;

	//  customerAddress => isRegistered
	mapping(address => bool) public customers;

	//  driverAddress => isRegistered
	mapping(address => bool) public drivers;

	// Mapping to store orders by order ID (orderId => Order struct)
	//mapping(uint => Order) public Orders;

	// Mapping to track which Ethereum address is used
	//mapping(address => bool) public addressUsed;

	// keep track of orders(order Ids) for each customer, store, and driver
	mapping(address => uint[]) public customerOrderIds;
	mapping(address => uint[]) public driverOrderIds;
	mapping(address => uint[]) public storeOrderIds;

	// events
	event OrderPlaced(address indexed customer, address indexed store, uint indexed orderId, uint totalAmount, uint processingFee);
	event OrderStateChanged(unit indexed orderId, OrderState status);
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

	// place order function
	function placeOrder(string memory _customerName, string memory _storeName, uint _foodTotal, uint _foodTip, uint _deliveryFee, uint _deliveryTip) external payable{
		require(msg.value == (_foodTotal + _foodTip + _deliveryFee + _deliveryTip), "Insufficient payment for order");
		orderCounter++;
		Orders[orderCounter] = Order({
			customer: customers[_customerName].accountAddress
		}

		)




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