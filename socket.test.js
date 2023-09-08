const { Server } = require("socket.io");
const Client = require("socket.io-client");
const { escape } = require('validator');
let io, serverSocket, clientSocket;

beforeAll((done) => {
  io = new Server(3000);
  const sanitize = require('./middleware/socket/sanitize');
  io.use(sanitize);
  clientSocket = new Client("http://localhost:3000");
  io.on("connection", (socket) => {
    serverSocket = socket;
  });
  clientSocket.on("connect", done);
});

afterAll(() => {
  io.close();
  clientSocket.close();
});

describe("Sanitization Middleware", () => {
  it("should sanitize incoming string data", (done) => {
    const payload = "<h1>Hi</h1>";
    const sanitizedPayload = escape(payload); // escaping logic using `validator`

    clientSocket.emit("testEvent", {payload});

    serverSocket.on("testEvent", (data) => {
      expect(data.payload).toBe(sanitizedPayload);
      done();
    });
  });
});