import { Server } from 'socket.io';
import express from 'express';
import * as http from "node:http";

const app = express();
const server = http.createServer(app);
const io = new Server(server,
    {
        cors: {
            origin: ["http://localhost:5173", "http://localhost:5174"],
            methods: ["GET", "POST"],
            allowedHeaders: ["my-custom-header"],
            credentials: true
        }
    }
);

const offers = [];
const connectedSockets = [];

io.on('connection', (socket) => {
    const userName = socket.handshake.auth.userName;
    connectedSockets.push({
        socketId: socket.id,
        userName,
    });

    if (offers.length) {
        socket.emit("availableOffers", offers);
    }

    socket.on('newOffer', newOffer => {
        const existingOfferIndex = offers.findIndex(offer => offer.offerUserName === userName);

        if (existingOfferIndex !== -1) {
            offers[existingOfferIndex] = {
                socketId: socket.id,
                offerUserName: userName,
                offer: newOffer,
                offerIceCandidates: [],
                answererUserName: null,
                answer: null,
                answerIceCandidates: []
            };
        } else {
            const offer = {
                socketId: socket.id,
                offerUserName: userName,
                offer: newOffer,
                offerIceCandidates: [],
                answererUserName: null,
                answer: null,
                answerIceCandidates: []
            };
            offers.push(offer);
        }
    });

    socket.on('newAnswer', (offerObj, ackFunction) => {
        const socketToAnswer = connectedSockets.find(socket => socket.userName === offerObj[0].offerUserName);
        const socketIdToAnswer = socketToAnswer.socketId;
        const offerToUpdate = offers.find(offer => offer.offerUserName === offerObj[0].offerUserName);
        if (!offerToUpdate) {
            console.log('Offer not found');
            return;
        }

        ackFunction(offerToUpdate.offerIceCandidates);
        offerToUpdate.answer = offerObj[0].answer;
        offerToUpdate.answererUserName = userName;
        socket.to(socketIdToAnswer).emit('answerResponse', offerToUpdate);
    });

    socket.on('newIceCandidate', newIceCandidate => {
        const { didIOffer, iceUserName, iceCandidate } = newIceCandidate;
        console.log("THIS IS THE DID I OFFER", didIOffer)
        const allOffer = offers.find(offer => offer.offerUserName === iceUserName);
        if (allOffer) {
            if (didIOffer) {
                allOffer.offerIceCandidates.push(iceCandidate);
            } else {
                allOffer.answerIceCandidates.push(iceCandidate);
            }
        }
    });

    socket.on('disconnect', () => {
        const index = connectedSockets.findIndex(sock => sock.socketId === socket.id);
        if (index !== -1) {
            connectedSockets.splice(index, 1);
        }
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
