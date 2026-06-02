import { useEffect } from 'react';

import ChannelTicketsPage from './ChannelTicketsPage';
import { processChatSessionTimeouts } from '../services/realtimeChat';


const LIVE_CHAT_TIMEOUT_INTERVAL_MS = 30000;

const LiveChatPage = () => {
  useEffect(() => {
    const runTimeoutCheck = () => {
      processChatSessionTimeouts().catch((error) => {
        console.error('Failed to process live chat timeout:', error);
      });
    };

    runTimeoutCheck();
    const intervalId = window.setInterval(
      runTimeoutCheck,
      LIVE_CHAT_TIMEOUT_INTERVAL_MS,
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <ChannelTicketsPage
      channelName="Website Chatbot"
      title="Live Chat Sessions"
      description="Real-time chat sessions from the website chatbot."
      workspaceBasePath="/live-chat"
    />
  );
};

export default LiveChatPage;
