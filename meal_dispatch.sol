// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

contract MealDispatchDApp {
	
	// Enums for order states 
	enum OrderStatus {
		Placed,
		Accepted,
		Delivered,
		Completed
	}

	// Structs for Store, Customer, Driver, and Order
	struct Store {
		string name;
		address accountAddress;
	}

	struct Customer {
		string name;
		address accountAddress;
	}

	struct Driver {
		string name;
		address accountAddress;
	}

	struct Order {
		address customer;
		address store;
		address driver;
		uint foodTotal;
		uint foodTip;
		uint deliveryFee;
		uint deliveryTip;
		uint totalAmount;
		OrderStatus status;
	}

	// Mappings to store entities and orders

	// Mapping to link store names from saved stores (IPFS) to Store structs
	mapping(string => Store) public stores;

	// Mapping to link customer names from saved customers (IPFS) to Customer structs
	mapping(string => Customer) public customers;

	// Mapping to link driver names from saved drivers (IPFS) to Driver structs
	mapping(string => Driver) public drivers;

	// events
	event OrderPlaced(address indexed customer, address indexed store, uint indexed orderId);
	event OrderAccepted(address indexed store, uint indexed orderId);
	event OrderDelivered(address indexed driver, uint indexed orderId);
	event OrderCompleted(address indexed customer, uint indexed orderId);	
	event StoreRegistered(string storName, address indexed accountAddress);
	event CustomerRegistered(string customerName, address indexed accountAddress);
	event DriverRegistered(string driverName, address indexed accountAddress);
	event PaymentReceived(address indexed from, uint amount);

	// constructor
	constructor() {}
}