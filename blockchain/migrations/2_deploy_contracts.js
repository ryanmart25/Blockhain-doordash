// Truffle Migration Script for MealDispatchDApp Smart Contract
// This file is used by Truffle to deploy the smart contract to the blockchain

// Import the contract artifact
const MealDispatchDApp = artifacts.require("MealDispatchDApp");

// Export the deployment function
// Truffle will call this function during migration
module.exports = function(deployer) {
  // Deploy the MealDispatchDApp contract
  // The deployer.deploy() function handles the deployment transaction
  deployer.deploy(MealDispatchDApp);
};
