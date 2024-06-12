import {SocketProvider} from "./context/context.tsx";
import WebRTC from "./componants/WebRTC.tsx";

const Home = () => {
    return (
        <SocketProvider>

                <WebRTC />

        </SocketProvider>
    );
};

export default Home;
