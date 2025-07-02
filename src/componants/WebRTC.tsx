import './App.css'
import React, { useContext, useEffect, useRef, useState } from "react";
import { servers } from "../config/server-config.ts";
import { SocketContext } from "../context/context.tsx";

function WebRTC() {
    type videoInputs = {
        deviceId: string,
        groupId: string,
        kind: string,
        label: string
    }

    const { socket, userName } = useContext(SocketContext);
    const localVideo = useRef<HTMLVideoElement>(null)
    const remoteVideo = useRef<HTMLVideoElement>(null)
    const [localMediaStreams, setLocalMediaStreams] = useState<MediaStream | null>(null)
    const [videoInputs, setVideoInputs] = useState<videoInputs[]>([])
    const [didIOffer, setDidIOffer] = useState<boolean>(false)
    const didIOfferRef = useRef(didIOffer);

    const  [readyToCall, setReadyToCall] = useState<boolean>(false)
    const [offers, setOffers] = useState<any[]>([])
    const peerConnection = useRef<RTCPeerConnection | null>(null)

    useEffect(() => {
        didIOfferRef.current = didIOffer; // Update the ref whenever didIOffer changes
    }, [didIOffer]);

/*    const getDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.getUserMedia(constraints)
            if(localVideo.current)  localVideo.current.srcObject = devices
            setLocalMediaStreams(devices)
            const allDevices = await navigator.mediaDevices.enumerateDevices()
            setVideoInputs(allDevices.filter(device => device.kind === 'videoinput'))
        } catch (err) {
            console.log('Error getting devices:', err)
        }
    }*/


    const getDevices = async () => {
        try{
            const device = await navigator.mediaDevices.getUserMedia({audio: false, video:true})
            if(localVideo.current)  localVideo.current.srcObject = device
            setLocalMediaStreams(device)
            const allDevice = await navigator.mediaDevices.enumerateDevices()
            setVideoInputs(allDevice.filter(device => device.kind === 'videoinput'))
        }catch (err){
            console.log("Error", err)
        }

    }

    const changeVideoStream = async ( e:  React.ChangeEvent<HTMLSelectElement> ) =>{
        const newVideoStream = await navigator.mediaDevices.getUserMedia({audio:false, video: {deviceId: e.target.value}})

        if(localVideo.current) localVideo.current.srcObject = newVideoStream
    }

/*    const changeVideoStream = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newVideoStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: e.target.value },
            audio: false
        });

        if (localVideo.current) localVideo.current.srcObject = newVideoStream;

        if (peerConnection.current) {
            const senders = peerConnection.current.getSenders();

            const videoTrack = newVideoStream.getVideoTracks()[0];
            const sender = senders.find(s => s.track?.kind === 'video');

            if (sender) {
                sender.replaceTrack(videoTrack);
            }
            // Update local media streams state
            setLocalMediaStreams(newVideoStream);
        }
    };*/

    const createNewPeerConnection = async (offerObj: { offer: RTCSessionDescriptionInit; } | undefined) => {
        peerConnection.current = new RTCPeerConnection(servers)
        if (localMediaStreams) {
            localMediaStreams.getTracks().forEach(track => peerConnection.current?.addTrack(track, localMediaStreams))
        }

        peerConnection.current.onicecandidate = (event) => {
            console.log('ICE candidate event:', event)
            if (event.candidate) {
                socket.emit('newIceCandidate', {
                    iceCandidate: event.candidate,
                    iceUserName: userName,
                    didIOffer: didIOfferRef.current  // Ensuring didIOffer is correctly passed
                })
            }
            console.log('Current PeerConnection State:', peerConnection.current);
        }

        peerConnection.current.oniceconnectionstatechange = () => {
            console.log('ICE connection state change:', peerConnection.current?.iceConnectionState)
        }

        peerConnection.current.ontrack = (event) => {
            console.log('Remote track received:', event.streams)
            if (remoteVideo.current) {
                remoteVideo.current.srcObject = event.streams[0]
            }
        }

        if (offerObj) {
            await peerConnection.current.setRemoteDescription(offerObj.offer)
        }
    };

    const call = async () => {
        await createNewPeerConnection()

        try {
            const offer = await peerConnection.current?.createOffer()
            await peerConnection.current?.setLocalDescription(offer)
            setDidIOffer(true)

            socket.emit('newOffer', { offer, userName })
        } catch (err) {
            console.log('Error during call setup:', err)
        }
    }

    useEffect(() => {
        if (localMediaStreams) {
            startVideo();
        }
    }, [localMediaStreams]);


    const startVideo = () => {
        if (localVideo.current) {
            localVideo.current.srcObject = localMediaStreams
        }
    }

    const stopVideo = () => {
        const tracks = localMediaStreams?.getTracks()
        console.log('Stopping tracks:', tracks)
        if (tracks) tracks.forEach(track => track.stop())
        console.log('Tracks stopped')
    }

    const shareScreen = async () => {
        const sharedScreen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        if (localVideo.current) localVideo.current.srcObject = sharedScreen;

        if (peerConnection.current) {
            const senders = peerConnection.current.getSenders();

            // Replace the video track in the peer connection
            const screenTrack = sharedScreen.getVideoTracks()[0];
            const sender = senders.find(s => s.track?.kind === 'video');

            if (sender) {
                sender.replaceTrack(screenTrack);
            } else {
                sharedScreen.getTracks().forEach(track => peerConnection.current?.addTrack(track, sharedScreen));
            }

            // When the screen sharing stops, revert to the original video stream
            screenTrack.onended = async () => {
                if (localVideo.current) localVideo.current.srcObject = localMediaStreams;

                const videoTrack = localMediaStreams?.getVideoTracks()[0];
                if (videoTrack && sender) {
                    sender.replaceTrack(videoTrack);
                } else if (videoTrack) {
                    localMediaStreams?.getTracks().forEach(track => peerConnection.current?.addTrack(track, localMediaStreams));
                }
            };
        }
    };

    socket.on("availableOffers", async (offers) => {
        setReadyToCall(true)
        setOffers(offers)
    })

    const answerTheCall = async (offers) => {
        await createNewPeerConnection( offers[0].offer )
        const answer = await peerConnection.current?.createAnswer()
        if(answer) {
            peerConnection.current?.setLocalDescription(answer)
        }
        offers[0].answer = answer
        const offerIceCandidates = await  socket.emitWithAck('newAnswer', offers)
        offerIceCandidates.forEach((iceCandidate) => {
            peerConnection.current?.addIceCandidate(iceCandidate)
            console.log("======Added Ice Candidates======")
        })

    }


    const addAnswer = async (answerObj: { answer: RTCSessionDescriptionInit; }) => {
        await peerConnection.current?.setRemoteDescription(answerObj.answer)
        console.log(peerConnection.current.signalingState)
    }

    socket.on('answerResponse', offerObj => {
        addAnswer(offerObj)
    })

    socket.on('newIceCandidate', async (candidateObj) => {
        try {
            await peerConnection.current?.addIceCandidate(candidateObj.iceCandidate)
        } catch (err) {
            console.error('Error adding received ice candidate', err)
        }
    })

    return (
        <>
            <div className="container row">
                <div className="leftSidbarDiv buttons col-4">
                    <h1>{userName}</h1>
                    <button onClick={getDevices} id="share" className="btn btn-primary d-block mb-1">Share my mic and camera</button>
                    <button onClick={stopVideo} id="stop-video" className="btn btn-secondary d-block mb-1">Stop My Video</button>
                    <button onClick={shareScreen} id="share-screen" className="btn btn-secondary d-block mb-1">Share Screen</button>
                    <button onClick={call} id="call" className="btn btn-secondary d-block mb-1">Call</button>
                    {readyToCall && <button onClick={() => answerTheCall(offers)} id="getOffers" className="btn btn-secondary d-block mb-1">Answer the Call</button>}
                    <div>
                        <label>Select video input: </label>
                        <select id="video-input" onChange={(e) => changeVideoStream(e)}>
                            {
                                videoInputs.map((videoInput) => <option key={videoInput.deviceId} value={videoInput.deviceId}>{videoInput.label}</option>)
                            }
                        </select>
                    </div>
                </div>
                <div className="videos col-8">
                    <div>
                        <h3>My feed</h3>
                        <video ref={localVideo} muted={true} id="my-video" className="video" autoPlay controls playsInline></video>
                    </div>
                    <div>
                        <h3>Their feed</h3>
                        <video ref={remoteVideo} id="other-video" className="video" autoPlay playsInline></video>
                    </div>
                </div>
            </div>
        </>
    )
}

export default WebRTC
