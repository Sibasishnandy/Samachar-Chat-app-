import { useState, useEffect, useRef } from "react";
import "./HomePage.css";
import defaultAvatar from "./Assets/default-avatar.png";
import io from "socket.io-client";

const socket = io("https://samachar-chat-app-uo4y.onrender.com", { autoConnect: false });

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [notifications, setNotifications] = useState({});
  const [onlineUsers, setOnlineUsers] = useState([]);
  const chatEndRef = useRef(null);

  // Scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initial load
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    setUser(storedUser);

    if (storedUser) {
      socket.connect();
      socket.emit("user_connected", storedUser.email);

      fetch("https://samachar-chat-app-uo4y.onrender.com/getallusers_api")
        .then((res) => res.json())
        .then((data) => {
          const others = data.filter((u) => u.email !== storedUser.email);
          setContacts(others);
        });

      fetch(`https://samachar-chat-app-uo4y.onrender.com/unread_count/${storedUser.email}`)
        .then((res) => res.json())
        .then((data) => {
          const notif = {};
          data.forEach((item) => {
            notif[item._id] = item.count;
          });
          setNotifications(notif);
        });

      socket.on("receive_message", (msg) => {
        const chatOpen =
          (msg.sender === user?.email && msg.receiver === selectedContact?.email) ||
          (msg.sender === selectedContact?.email && msg.receiver === user?.email);

        if (chatOpen) {
          setMessages((prev) => [...prev, msg]);
        }

        if (msg.receiver === user?.email && !chatOpen) {
          setNotifications((prev) => ({
            ...prev,
            [msg.sender]: (prev[msg.sender] || 0) + 1,
          }));
        }
      });

      socket.on("update_online_users", (users) => {
        setOnlineUsers(users);
      });
    }

    return () => socket.disconnect();
  }, [selectedContact]);

  // Load chat messages and clear notifications
  useEffect(() => {
    if (user && selectedContact) {
      fetch(`https://samachar-chat-app-uo4y.onrender.com/get_messages/${user.email}/${selectedContact.email}`)
        .then((res) => res.json())
        .then((data) => {
          setMessages(data);
          setNotifications((prev) => {
            const updated = { ...prev };
            delete updated[selectedContact.email];
            return updated;
          });
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

    socket.emit("send_message", msg);

    setMessages((prev) => [
      ...prev,
      { ...msg, timestamp: new Date().toISOString() }
    ]);

    setNewMessage("");
  };

  const filteredContacts = contacts.filter((contact) =>
    contact.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container">
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
              className={`contact_item 
                ${selectedContact?.email === contact.email ? "active" : ""} 
                ${notifications[contact.email] > 0 ? "highlight" : ""}`}
              onClick={() => setSelectedContact(contact)}
            >
              <img
                src={contact.profile_pic || defaultAvatar}
                alt={contact.full_name}
                className="contact-img"
              />
              <div className="contact-info">
                <span>{contact.full_name}</span>
                <span
                  className={`status-dot ${
                    onlineUsers.includes(contact.email) ? "online" : "offline"
                  }`}
                ></span>
              </div>
              {notifications[contact.email] > 0 && (
                <span className="notification-badge">
                  {notifications[contact.email]}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

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
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
            <img src={user.profile_pic || defaultAvatar} alt="Profile" className="profile-img" />
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
