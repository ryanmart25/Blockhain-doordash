// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

contract MealDispatchDApp {
	enum OrderStatus {
		Placed,
		Accepted,
		Delivered,
		Completed
	}

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
		OrderStatus status;
	}

}