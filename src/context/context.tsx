import { createContext } from 'react';
import { io, Socket } from 'socket.io-client';

const userName = "John Doe"+Math.floor(Math.random()*1000)
const password = '123456'

const socket = io('http://localhost:3000',
        {
            auth:{
                userName,
                password
            },
        reconnectionDelay: 1000,
        reconnection: true,
        reconnectionAttempts: 10,
        agent: false,
        upgrade: false,
        rejectUnauthorized: false,
    }),
    SocketContext = createContext<{ socket: Socket, userName: string }>({ socket, userName });

socket.on('connect', () => {
    // eslint-disable-next-line no-console
    console.log('someone connected: ', socket?.id);
});

const SocketProvider = ({ children }: any) => {
    return (
        <SocketContext.Provider value={{socket, userName}}>{children}</SocketContext.Provider>
    );
};
export { SocketContext, SocketProvider };
