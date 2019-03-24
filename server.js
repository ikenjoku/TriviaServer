const fs = require('fs');
const _ = require('lodash');
const http = require('http');
const socket = require('socket.io');

const server = http.createServer(function () {});
const io = socket(server);
server.listen(5000, () => {
  console.log('Server is running on port 5000')
})

const players = {};
let questions = null;
let question = null;
let questionForPlayers = null;
let questionStartTime = null;
let numberAsked = 0;

function newGameData() {
  return {
    right: 0,
    wrong: 0,
    totalTime: 0,
    fastest: 999999999,
    slowest: 0,
    average: 0,
    points: 0,
    answered: 0,
    playerName: null
  };
}

function calculateLeaderboard() {
  const playersArray = [];
  for (const playerID in players) {
    if (players.hasOwnProperty(playerID)) {
      const player = players[playerID];
      playersArray.push({
        playerID: playerID,
        playerName: player.playerName,
        points: player.points
      });
    }
  }
  playersArray.sort((inA, inB) => {
    const pointsA = inA.points;
    const pointsB = inB.points;
    if (pointsA > pointsB) {
      return -1;
    } else if (pointsA < pointsB) {
      return 1;
    } else {
      return 0;
    }
  });
  return playersArray;
}

io.on('connection', client => {
  client.emit('connected', (client) => {
    console.log(`Socket connection established with ${client.id}`)
  });

  client.on('validatePlayer', inData => {
    try {
      const responseObject = {
        inProgress: inProgress,
        gameData: newGameData(),
        leaderboard: calculateLeaderboard(),
        asked: numberAsked
      };
      responseObject.gameData.playerName = inData.playerName;
      responseObject.playerID = `pi_${new Date().getTime()}`;
      for (const playerID in players) {
        if (players.hasOwnProperty(playerID)) {
          if (inData.playerName === players[playerID].playerName) {
            responseObject.gameData.playerName += `_${new Date().getTime()}`;
          }
        }
      }
      players[responseObject.playerID] = responseObject.gameData;
      client.emit("validatePlayer", responseObject);
    } catch (inException) {
      console.log(`${inException}`);
    }
  });

  client.on('submitAnswer', inData => {
    try {
      const gameData = players[inData.playerID];
      let correct = false;
      gameData.answered++;
      if (question.answer === inData.answer) {
        players[inData.playerID].right++;
        players[inData.playerID].wrong--;
        const time = new Date().getTime() - questionStartTime;
        gameData.totalTime = gameData.totalTime + time;
        if (time > gameData.slowest) {
          gameData.slowest = time;
        }
        if (time < gameData.fastest) {
          gameData.fastest = time;
        }
        gameData.average = Math.trunc(gameData.totalTime / numberAsked);
        const maxTimeAllowed = 15;
        gameData.points = gameData.points + (maxTimeAllowed * 4);
        gameData.points = gameData.points - Math.min(Math.max(
          Math.trunc(time / 250), 0), (maxTimeAllowed * 4));
        gameData.points = gameData.points + 10;
        correct = true;

      }
      client.emit("answerOutcome", {
        correct: correct,
        gameData: gameData,
        asked: numberAsked,
        leaderboard: calculateLeaderboard()
      });
    } catch (inException) {
      console.log(`${inException}`);
    }
  });

  client.on('adminNewGame', () => {
    try {
      question = null;
      questionForPlayers = null;
      numberAsked = 0;
      inProgress = true;
      questions = (JSON.parse(fs.readFileSync("data/question.json", "utf8"))).questions;
      for (const playerID in players) {
        if (players.hasOwnProperty(playerID)) {
          const playerName = players[playerID].playerName;
          players[playerID] = newGameData();
          players[playerID].playerName = playerName;
        }
      }
      const responseObject = {
        inProgress: inProgress,
        question: null,
        playerID: null,
        gameData: newGameData(),
        asked: numberAsked,
        leaderboard: calculateLeaderboard()
      };
      const gd = newGameData();
      gd.asked = 0;
      client.broadcast.emit("newGame", responseObject);
      client.emit("adminMessage", {
        msg: "Game started"
      });
    } catch (inException) {
      console.log(`${inException}`);
    }
  });

  client.on('adminNextQuestion', () => {
    try {
      if (!inProgress) {
        client.emit("adminMessage", {
          msg: "There is no game in progress"
        });
        return;
      }
      if (questions.length === 0) {
        client.emit("adminMessage", {
          msg: "There are no more questions"
        });
        return;
      }
      for (const playerID in players) {
        if (players.hasOwnProperty(playerID)) {
          players[playerID].wrong++;
        }
      }
      let choice = Math.floor(Math.random() * questions.length);
      question = questions.splice(choice, 1)[0];
      questionForPlayers = {
        question: question.question,
        answers: []
      };
      const decoys = question.decoys.slice(0);
      for (let i = 0; i < 5; i++) {
        let choice = Math.floor(Math.random() * decoys.length);
        questionForPlayers.answers.push(decoys.splice(choice, 1)[0]);
      }
      questionForPlayers.answers.push(question.answer);
      questionForPlayers.answers = lodash.shuffle(questionForPlayers.answers);
      numberAsked++;
      questionStartTime = new Date().getTime();
      client.broadcast.emit("nextQuestion", questionForPlayers);
      client.emit("adminMessage", {
        msg: "Question in play"
      });
    } catch (inException) {
      console.log(`${inException}`);
    }
  });
  client.on('adminEndGame', () => {
    try {
      if (!inProgress) {
        client.emit("adminMessage", {
          msg: "There is no game in progress"
        });
        return;
      }
      const leaderboard = calculateLeaderboard();
      client.broadcast.emit("endGame", {
        leaderboard: leaderboard
      });
      inProgress = false;
      questions = null;
      question = null;
      questionForPlayers = null;
      questionStartTime = null;
      numberAsked = 0;
      for (const playerID in players) {
        if (players.hasOwnProperty(playerID)) {
          const playerName = players[playerID].playerName;
          players[playerID] = newGameData();
          players[playerID].playerName = playerName;
        }
      }
      client.emit("adminMessage", {
        msg: "Game ended"
      });
    } catch (inException) {
      console.log(`${inException}`);
    }
  });
});