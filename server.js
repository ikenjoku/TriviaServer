const fs = require('fs');
const _  = require('lodash');
const http = require('http');
const socket = require('socket.io');

const server = http.createServer(function(){});
const io = socket(server.listen(80));

const players = { };
let questions = null;
let question = null;
let questionForPlayers = null;
let questionStartTime = null;
let numberAsked = 0;