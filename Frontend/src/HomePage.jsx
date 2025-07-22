// src/HomePage.jsx
import { useState, useEffect, useRef } from "react";
import "./HomePage.css";
import defaultAvatar from "./Assets/default-avatar.png";
import io from "socket.io-client";

// Connect to backend
const socket = io("http://localhost:5000");

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const chatEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    setUser(storedUser);

    if (storedUser) {
      socket.emit("user_connected", storedUser.email);

      fetch("http://localhost:5000/getallusers_api")
        .then((res) => res.json())
        .then((data) => {
          const otherUsers = data.filter((u) => u.email !== storedUser.email);
          setContacts(otherUsers);
        });
    }

    socket.on("receive_message", (msg) => {
      if (
        (msg.sender === user?.email && msg.receiver === selectedContact?.email) ||
        (msg.sender === selectedContact?.email && msg.receiver === user?.email)
      ) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedContact]);

  // Load messages when contact is selected
  useEffect(() => {
    if (user && selectedContact) {
      fetch(`http://localhost:5000/get_messages/${user.email}/${selectedContact.email}`)
        .then((res) => res.json())
        .then((data) => {
          setMessages(data);
        });
    }
  }, [selectedContact]);

  const handleSend = () => {
    if (!newMessage.trim()) return;

    const msg = {
      sender: user.email,
      receiver: selectedContact.email,
      text: newMessage,
    };
    // console.log("Sending message via socket:", msg);
    socket.emit("send_message", msg);

    // Show message instantly in UI
    setMessages((prev) => [
      ...prev,
      {
        ...msg,
        timestamp: new Date().toISOString(),
      },
    ]);

    setNewMessage("");
  };

  const filteredContacts = contacts.filter((contact) =>
    contact.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container">
      {/* Right Section: Contact List */}
      <div className="right_section">
        <h2>Contacts</h2>
        <input
          type="text"
          className="search-bar"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <ul className="contact_list">
          {filteredContacts.map((contact) => (
            <li
              key={contact.email}
              className={`contact_item ${selectedContact?.email === contact.email ? "active" : ""}`}
              onClick={() => setSelectedContact(contact)}
            >
              <img
                src={contact.profile_pic || defaultAvatar}
                alt={contact.full_name}
                className="contact-img"
              />
              <span>{contact.full_name}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Left Section: Chat Area */}
      <div className="left_section">
        {selectedContact ? (
          <div className="chat-container">
            <div className="chat-header">
              <img
                src={selectedContact.profile_pic || defaultAvatar}
                alt={selectedContact.full_name}
                className="profile-img"
              />
              <h3>{selectedContact.full_name}</h3>
            </div>
            <div className="chat-messages">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`chat-bubble ${msg.sender === user.email ? "sent" : "received"}`}
                >
                  <p>{msg.text}</p>
                  <span className="timestamp">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="chat-input">
              <input
                type="text"
                value={newMessage}
                placeholder="Type a message..."
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button onClick={handleSend}>Send</button>
            </div>
          </div>
        ) : user ? (
          <div className="welcome-screen">
            <img
              src={user.profile_pic || defaultAvatar}
              alt="Profile"
              className="profile-img"
            />
            <h2>Welcome, {user.full_name}</h2>
            <p>{user.email}</p>
          </div>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    </div>
  );
}
