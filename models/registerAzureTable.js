var azure = require('azure-storage');
var uuid = require('node-uuid');
var entityGen = azure.TableUtilities.entityGenerator;


module.exports = RegisterAzureTable;

function RegisterAzureTable(storageClient, tableName, partitionKey) {
 this.storageClient = storageClient;
 this.tableName = tableName;
 this.partitionKey = partitionKey;
 this.storageClient.createTableIfNotExists(tableName, function tableCreated(error) {
   if(error) {
     throw error;
   }
 });
};