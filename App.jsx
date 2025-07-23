import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, orderBy, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

// Global variables provided by the Canvas environment
declare const __app_id: string | undefined;
declare const __firebase_config: string | undefined;
declare const __initial_auth_token: string | undefined;

function App() {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null); // New state for user's display name
  const [db, setDb] = useState<any>(null);
  const [auth, setAuth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Firebase and set up authentication
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

        if (!Object.keys(firebaseConfig).length) {
          throw new Error("Firebase config not provided.");
        }

        const app = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(app);
        const firebaseAuth = getAuth(app);

        setDb(firestoreDb);
        setAuth(firebaseAuth);

        // Load user name from local storage
        const storedUserName = localStorage.getItem('chatUserName');
        if (storedUserName) {
          setUserName(storedUserName);
        } else {
          // Set a default name if none is stored
          setUserName(`User-${Math.random().toString(36).substring(7)}`);
        }

        // Listen for auth state changes
        const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (user) => {
          if (user) {
            setUserId(user.uid);
            setLoading(false); // Auth is ready
          } else {
            // Sign in anonymously if no initial token or user is not signed in
            try {
              if (typeof __initial_auth_token !== 'undefined') {
                await signInWithCustomToken(firebaseAuth, __initial_auth_token);
              } else {
                await signInAnonymously(firebaseAuth);
              }
            } catch (authError: any) {
              console.error("Firebase Auth Error:", authError);
              setError(`Authentication failed: ${authError.message}`);
              setLoading(false);
            }
          }
        });

        return () => unsubscribeAuth(); // Cleanup auth listener
      } catch (err: any) {
        console.error("Firebase Initialization Error:", err);
        setError(`Failed to initialize Firebase: ${err.message}`);
        setLoading(false);
      }
    };

    initializeFirebase();
  }, []);

  // Set up real-time message listener
  useEffect(() => {
    if (db && userId) {
      const messagesCollectionRef = collection(db, `artifacts/${__app_id || 'default-app-id'}/public/data/messages`);
      // Ordering by timestamp is commented out as per instructions to avoid index issues,
      // but in a real app, you'd typically use it and add an index.
      // const q = query(messagesCollectionRef, orderBy('timestamp', 'asc'));
      const q = query(messagesCollectionRef); // Fetching without orderBy

      const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const fetchedMessages: any[] = [];
        snapshot.forEach((doc) => {
          fetchedMessages.push({ id: doc.id, ...doc.data() });
        });
        // Sort messages in memory by timestamp if orderBy is not used in query
        fetchedMessages.sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));
        setMessages(fetchedMessages);
      }, (error) => {
        console.error("Error fetching messages:", error);
        setError(`Failed to fetch messages: ${error.message}`);
      });

      return () => unsubscribeSnapshot(); // Cleanup snapshot listener
    }
  }, [db, userId]); // Re-run when db or userId changes

  // Scroll to the bottom of the messages list
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending a new message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !db || !userId || !userName) {
      return;
    }

    try {
      const messagesCollectionRef = collection(db, `artifacts/${__app_id || 'default-app-id'}/public/data/messages`);
      await addDoc(messagesCollectionRef, {
        senderId: userId,
        senderName: userName, // Include sender's name
        text: newMessage,
        timestamp: serverTimestamp(), // Firestore server timestamp
      });
      setNewMessage(''); // Clear input field
    } catch (err: any) {
      console.error("Error sending message:", err);
      setError(`Failed to send message: ${err.message}`);
    }
  };

  // Handle user name change
  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setUserName(newName);
    localStorage.setItem('chatUserName', newName); // Persist name in local storage
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">Loading chat...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-4">
        <div className="text-lg font-semibold">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-800 font-inter">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-md p-4 flex flex-col sm:flex-row items-center justify-between rounded-b-lg">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 sm:mb-0">Gemini Chat</h1>
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
          {userId && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Your User ID: <span className="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-md">{userId}</span>
            </div>
          )}
          <div className="flex items-center">
            <label htmlFor="userNameInput" className="text-sm text-gray-600 dark:text-gray-400 mr-2">Your Name:</label>
            <input
              id="userNameInput"
              type="text"
              value={userName || ''}
              onChange={handleUserNameChange}
              placeholder="Enter your name"
              className="p-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white w-32 sm:w-auto"
              aria-label="Your display name"
            />
          </div>
        </div>
      </header>

      {/* Chat Messages Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-10">
            No messages yet. Start the conversation!
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderId === userId ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-xl shadow-md ${
                msg.senderId === userId
                  ? 'bg-blue-500 text-white rounded-br-none'
                  : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-bl-none'
              }`}
            >
              <div className="font-semibold text-sm mb-1">
                {msg.senderId === userId ? 'You' : (msg.senderName || msg.senderId)}
              </div>
              <p className="break-words">{msg.text}</p>
              <div className="text-xs mt-1 opacity-80">
                {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} /> {/* Scroll target */}
      </main>

      {/* Message Input Area */}
      <footer className="bg-white dark:bg-gray-900 p-4 shadow-t-md rounded-t-lg">
        <form onSubmit={handleSendMessage} className="flex space-x-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white"
            aria-label="New message"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            aria-label="Send message"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}

export default App;
