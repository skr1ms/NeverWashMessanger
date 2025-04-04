/**
 * NEVER.WASH Chat Application
 * Main chat functionality
 */
document.addEventListener("DOMContentLoaded", () => {
  // Global variables
  let currentUsername = "";
  let currentAvatarId = 1;
  let activeChatUser = null;
  let socket = null; // Using Socket.IO instead of vanilla WebSockets
  let recentChats = new Set();

  // DOM Elements
  const userAvatar = document.querySelector(".clickable-avatar");
  const userModal = document.getElementById("avatar-options-modal");
  const chatContainer = document.querySelector(".content");
  const chatSidebar = document.querySelector(".chat-sidebar ul");
  const searchInput = document.querySelector(".search-input");
  const messageInput = document.getElementById("message-input");
  const sendMessageBtn = document.getElementById("send-message");

  // Initialize application
  init();

  /**
   * Main initialization function
   * Fetches user data and sets up the chat environment
   */
  async function init() {
    try {
      // Get user information from the server
      const response = await fetch("/get-user-info");
      if (response.ok) {
        const userData = await response.json();
        currentUsername = userData.username;
        currentAvatarId = userData.avatar_id;

        // Update UI with user information
        updateUserInfo(currentUsername, currentAvatarId);

        // Set up WebSocket connection for chat
        setupSocketConnection();

        // Load list of contacts
        await loadContacts();

        // Show welcome message
        await showWelcomeMessage();

        // Set up event listeners for UI elements
        setupEventListeners();

        // Add styles for message display
        setupChatStyles();
      } else {
        // If not authorized, redirect to login page
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Error initializing chat:", error);
    }
  }

  /**
   * Updates user information in UI
   * @param {string} username - User's username
   * @param {number} avatarId - User's avatar ID
   */
  function updateUserInfo(username, avatarId) {
    const usernameElement = document.querySelector(".username");
    if (usernameElement) {
      usernameElement.textContent = username;
    }

    const avatarElement = document.querySelector(".avatar");
    if (avatarElement) {
      avatarElement.src = `/static/sources/avatar${avatarId}.jpg`;
      avatarElement.alt = `${username}'s avatar`;
    }
  }

  /**
   * Sets up Socket.IO connection
   * Initializes event handlers for socket events
   */
  function setupSocketConnection() {
    // Initialize Socket.IO
    socket = io();

    // Connection handler
    socket.on("connect", () => {
      console.log("WebSocket connected successfully");

      // Send authentication information
      socket.emit("auth", { username: currentUsername });
    });

    // Connection error handler
    socket.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error);
      showNotification(
        "Connection Error",
        "Please check your internet connection",
        "error"
      );
    });

    // Disconnect handler
    socket.on("disconnect", () => {
      console.log("Socket.IO disconnected");
      showNotification(
        "Connection Lost",
        "Attempting to reconnect...",
        "warning"
      );
    });

    // Incoming message handler
    socket.on("message", (data) => {
      handleIncomingMessage(data);
    });
  }

  /**
   * Displays notifications to the user
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {string} type - Notification type (info, warning, error)
   */
  function showNotification(title, message, type = "info") {
    // Create notification element
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-title">${title}</div>
      <div class="notification-message">${message}</div>
    `;

    // Style the notification
    notification.style.position = "fixed";
    notification.style.top = "20px";
    notification.style.right = "20px";
    notification.style.backgroundColor =
      type === "error" ? "#ff5252" : type === "warning" ? "#ffb300" : "#4caf50";
    notification.style.color = "white";
    notification.style.padding = "10px 20px";
    notification.style.borderRadius = "4px";
    notification.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
    notification.style.zIndex = "9999";
    notification.style.opacity = "0";
    notification.style.transform = "translateY(-20px)";
    notification.style.transition = "all 0.3s ease";

    document.body.appendChild(notification);

    // Animate appearance
    setTimeout(() => {
      notification.style.opacity = "1";
      notification.style.transform = "translateY(0)";
    }, 10);

    // Automatically hide after 5 seconds
    setTimeout(() => {
      notification.style.opacity = "0";
      notification.style.transform = "translateY(-20px)";
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 5000);
  }

  /**
   * Loads the list of contacts
   * Fetches users the current user has communicated with
   */
  async function loadContacts() {
    try {
      const response = await fetch("/get-contacts");

      if (response.ok) {
        const data = await response.json();
        const { contacts } = data;

        if (contacts && contacts.length > 0) {
          // Add each contact to the sidebar
          contacts.forEach((contact) => {
            const { username } = contact;
            recentChats.add(username); // Add to chat list
            addChatToSidebar(username); // Display in sidebar
          });
        }
      } else {
        console.error("Failed to load contacts");
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  }

  /**
   * Displays welcome message to the user
   * Shows information about who invited the user
   */
  async function showWelcomeMessage() {
    const welcomeAlert = document.querySelector(".first_alert");
    if (!welcomeAlert) return;

    welcomeAlert.innerHTML = ""; // Clear content
    welcomeAlert.style.textAlign = "center"; // Center content
    welcomeAlert.style.padding = "20px 40px"; // Increased padding

    try {
      // Get invitation information
      const response = await fetch("/get-inviter-info");
      if (!response.ok) throw new Error("Failed to get invitation data");

      const data = await response.json();

      // Use existing CSS classes
      welcomeAlert.className = "first_alert";
      welcomeAlert.style.display = "block";
      welcomeAlert.style.opacity = "1";

      // 1. Add welcome header above logo
      const welcomeHeader = document.createElement("h2");
      welcomeHeader.className = "lato-bold";
      welcomeHeader.innerHTML = `Welcome to NEVER.WASH Chat,<br>${
        data.username || currentUsername || "User"
      }!`;
      welcomeHeader.style.color = "#091146";
      welcomeHeader.style.fontSize = "24px";
      welcomeHeader.style.marginBottom = "20px";
      welcomeAlert.appendChild(welcomeHeader);

      // 2. Add chat logo with increased size in the center
      const logoImage = document.createElement("img");
      logoImage.src = "/static/sources/logo.jpg";
      logoImage.alt = "NEVER.WASH Chat Logo";
      logoImage.className = "invite_avatar";
      logoImage.style.width = "300px"; // Set width to 300px
      logoImage.style.height = "300px"; // Set height to 300px
      logoImage.style.margin = "20px auto 40px"; // Center and add padding top/bottom
      logoImage.style.borderRadius = "15px"; // Softer edges for large image
      logoImage.style.objectFit = "cover"; // Ensure proper display of proportions
      logoImage.style.display = "block"; // Allow margin: auto for centering
      welcomeAlert.appendChild(logoImage);

      // 3. Add information about the inviting user, if available
      if (data.found) {
        const inviterInfo = document.createElement("div");
        inviterInfo.style.backgroundColor = "#f1f3ff";
        inviterInfo.style.borderRadius = "8px";
        inviterInfo.style.padding = "15px";
        inviterInfo.style.margin = "0 auto 25px";
        inviterInfo.style.color = "#091146";
        inviterInfo.style.maxWidth = "80%";

        const inviterTitle = document.createElement("p");
        inviterTitle.className = "lato-regular";
        inviterTitle.textContent = "You were invited by:";
        inviterTitle.style.fontSize = "16px";
        inviterTitle.style.margin = "0 0 8px 0";
        inviterInfo.appendChild(inviterTitle);

        const inviterName = document.createElement("p");
        inviterName.className = "lato-bold";
        inviterName.textContent = data.inviter_name;
        inviterName.style.fontSize = "20px";
        inviterName.style.margin = "0";
        inviterInfo.appendChild(inviterName);

        welcomeAlert.appendChild(inviterInfo);
      }

      // 4. Add "Start chatting" button
      const startButton = document.createElement("button");
      startButton.textContent = "Start chatting";
      startButton.className = "chat-button";
      startButton.style.fontSize = "18px";
      startButton.style.padding = "12px 35px";
      startButton.style.marginTop = "10px";

      // Button handler to open chat
      startButton.addEventListener("click", function () {
        closeWelcomeAndOpenChat();
      });

      welcomeAlert.appendChild(startButton);

      // 5. Automatically hide after 10 seconds and open chat
      setTimeout(() => {
        closeWelcomeAndOpenChat();
      }, 10000);
    } catch (error) {
      console.error("Error getting invitation information:", error);

      // Show standard welcome message on error
      welcomeAlert.className = "first_alert";
      welcomeAlert.style.display = "block";
      welcomeAlert.style.textAlign = "center";
      welcomeAlert.style.padding = "20px 40px";

      welcomeAlert.innerHTML = `
        <h2 class="lato-bold" style="color: #091146; font-size: 24px; margin-bottom: 20px;">Welcome to NEVER.WASH Chat!<br>${
          currentUsername || ""
        }</h2>
        <img src="/static/sources/logo.jpg" alt="NEVER.WASH Chat Logo" class="invite_avatar" style="width: 300px; height: 300px; margin: 20px auto 40px; border-radius: 15px; object-fit: cover; display: block;">
        <button class="chat-button" style="font-size: 18px; padding: 12px 35px; margin-top: 10px;">Start chatting</button>
      `;

      const startButton = welcomeAlert.querySelector(".chat-button");
      if (startButton) {
        startButton.addEventListener("click", function () {
          closeWelcomeAndOpenChat();
        });
      }

      // Appearance animation
      welcomeAlert.style.opacity = "0";
      setTimeout(() => {
        welcomeAlert.style.opacity = "1";
      }, 50);

      // Auto-hide and open chat
      setTimeout(() => {
        closeWelcomeAndOpenChat();
      }, 5000);
    }

    /**
     * Closes welcome message and opens chat
     * Common function for both success and error cases
     */
    function closeWelcomeAndOpenChat() {
      welcomeAlert.style.opacity = "0";

      setTimeout(() => {
        welcomeAlert.style.display = "none";

        // Find the first user in the chat list
        const firstChatLink = document.querySelector(".chat-link");
        if (firstChatLink) {
          // Simulate click on first chat
          firstChatLink.click();
        } else {
          // If no chats exist, open window for search
          const activeChat = document.getElementById("active-chat");
          if (activeChat) {
            activeChat.style.display = "flex";
          }

          // Show hint to find friends
          const contentSection = document.querySelector(".content");
          if (contentSection) {
            const searchPrompt = document.createElement("div");
            searchPrompt.className = "search-prompt";
            searchPrompt.innerHTML = `
              <h3 class="lato-bold">Start a new conversation</h3>
              <p class="lato-regular">Use the search bar on the left to find friends</p>
            `;
            searchPrompt.style.textAlign = "center";
            searchPrompt.style.padding = "30px";
            searchPrompt.style.color = "#555";

            // Add prompt to content if it doesn't already exist
            if (!document.querySelector(".search-prompt")) {
              contentSection.appendChild(searchPrompt);
            }
          }

          // Focus on search input
          const searchInput = document.querySelector(".search-input");
          if (searchInput) {
            searchInput.focus();
          }
        }
      }, 300);
    }
  }

  /**
   * Adds styles for chat messages
   * Creates a style element with CSS for message display
   */
  function setupChatStyles() {
    if (!document.getElementById("chat-message-styles")) {
      const styleEl = document.createElement("style");
      styleEl.id = "chat-message-styles";
      styleEl.textContent = `
        .chat-messages {
          display: flex;
          flex-direction: column;
          padding: 15px;
          height: calc(100% - 60px);
          overflow-y: auto;
          background-color: #f5f5f5;
        }
        
        .message-container {
          max-width: 100%;
          margin-bottom: 10px;
        }
        
        .message {
          padding: 8px 12px;
          border-radius: 18px;
          max-width: 70%;
          word-wrap: break-word;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        
        .own-message {
          background-color: #0084ff;
          color: white;
          border-bottom-right-radius: 4px;
          align-self: flex-end;
        }
        
        .message:not(.own-message) {
          background-color: #f0f0f0;
          color: #333;
          border-bottom-left-radius: 4px;
          align-self: flex-start;
        }
        
        .message-time {
          font-size: 10px;
          margin-top: 3px;
          padding: 0 8px;
          color: #000000 !important; /* Black color for timestamps */
        }
        
        .message-sender {
          font-size: 12px;
          color: #666;
          margin-bottom: 2px;
          padding-left: 8px;
        }

        .loading-history {
          text-align: center;
          color: #888;
          padding: 20px;
          font-style: italic;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }

  /**
   * Sets up all event listeners
   * Configures interactions for UI elements
   */
  function setupEventListeners() {
    // Avatar and dropdown menu
    if (userAvatar) {
      userAvatar.addEventListener("click", toggleUserModal);
    }

    // Close dropdown menu when clicking elsewhere
    document.addEventListener("click", (event) => {
      if (
        userModal &&
        userModal.style.display === "block" &&
        !userAvatar.contains(event.target) &&
        !userModal.contains(event.target)
      ) {
        userModal.style.display = "none";
      }
    });

    // User search
    if (searchInput) {
      searchInput.addEventListener("input", async () => {
        const query = searchInput.value.trim();
        if (query.length >= 3) {
          const users = await searchUsers(query);
          displaySearchResults(users);
        } else {
          const resultsElement = document.querySelector(".search-results");
          if (resultsElement) {
            resultsElement.innerHTML = "";
          }
        }
      });
    }

    // Send message button
    if (sendMessageBtn) {
      sendMessageBtn.addEventListener("click", sendMessage);
    }

    // Send message on Enter key
    if (messageInput) {
      messageInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    // Handlers for links in avatar dropdown menu
    const modalLinks = document.querySelectorAll(".modal-link");
    modalLinks.forEach((link) => {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        const target = this.getAttribute("data-target");
        
        // Hide dropdown menu
        if (userModal) {
          userModal.style.display = "none";
        }

        // Execute action based on selected option
        switch (target) {
          case "change-avatar":
            changeAvatar();
            break;
          case "invite-codes":
            showInviteCodes();
            break;
          case "delete-account":
            deleteAccount();
            break;
          case "exit":
            logout();
            break;
        }
      });
    });
  }

  /**
   * Handles incoming messages
   * @param {Object} messageData - Message data object
   */
  function handleIncomingMessage(messageData) {
    const { from, to, text, timestamp } = messageData;

    // Add sender to recent chats list if not already there
    if (!recentChats.has(from)) {
      recentChats.add(from);
      addChatToSidebar(from);
    }

    // If chat with this user is open, display the message
    if (activeChatUser === from) {
      displayMessage(from, text, false, timestamp);
    } else {
      // Show new message indicator in sidebar
      const chatLink = document.querySelector(
        `.chat-link[data-username="${from}"]`
      );
      if (chatLink) {
        // Add or update badge with unread message count
        let badge = chatLink.querySelector(".unread-badge");
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "unread-badge";
          badge.textContent = "1";
          badge.style.backgroundColor = "#ff3b30";
          badge.style.color = "white";
          badge.style.borderRadius = "50%";
          badge.style.padding = "2px 6px";
          badge.style.fontSize = "12px";
          badge.style.marginLeft = "8px";
          chatLink.appendChild(badge);
        } else {
          const count = parseInt(badge.textContent) + 1;
          badge.textContent = count.toString();
        }
      }

      // Also add desktop notification if browser supports it
      if (Notification && Notification.permission === "granted") {
        new Notification(`New message from ${from}`, {
          body: text.substring(0, 50) + (text.length > 50 ? "..." : ""),
          icon: "/static/sources/logo.jpg",
        });
      }
    }
  }

  /**
   * Sends a message to another user
   * Gets message text from input and sends via Socket.IO
   */
  function sendMessage() {
    if (!messageInput.value.trim() || !activeChatUser) return;

    const messageText = messageInput.value.trim();
    const timestamp = new Date().toISOString();

    // Create message object
    const message = {
      type: "message",
      from: currentUsername,
      to: activeChatUser,
      text: messageText,
      timestamp: timestamp,
    };

    // Send message via Socket.IO
    if (socket && socket.connected) {
      socket.emit("message", message);

      // Display own message on screen
      displayMessage(currentUsername, messageText, true, timestamp);

      // Clear input field
      messageInput.value = "";
    } else {
      showNotification(
        "Send Error",
        "Connection lost. Please refresh the page.",
        "error"
      );
    }
  }

  /**
   * Displays messages in the chat
   * @param {string} sender - Message sender username
   * @param {string} text - Message text content
   * @param {boolean} isOwnMessage - Whether message is from current user
   * @param {string} timestamp - Message timestamp
   */
  function displayMessage(sender, text, isOwnMessage, timestamp) {
    const chatMessages = document.querySelector(".chat-messages");
    if (!chatMessages) return;

    // Create message container
    const messageContainer = document.createElement("div");
    messageContainer.className = isOwnMessage
      ? "message-container own"
      : "message-container";
    messageContainer.style.display = "flex";
    messageContainer.style.width = "100%";
    messageContainer.style.marginBottom = "10px";
    messageContainer.style.flexDirection = "column";
    messageContainer.style.alignItems = isOwnMessage
      ? "flex-end"
      : "flex-start";

    // If message is from another user, show sender name
    if (!isOwnMessage) {
      const senderName = document.createElement("div");
      senderName.className = "message-sender";
      senderName.textContent = sender;
      senderName.style.fontSize = "12px";
      senderName.style.color = "#666";
      senderName.style.marginBottom = "3px";
      senderName.style.paddingLeft = "10px";
      messageContainer.appendChild(senderName);
    }

    // Create message block
    const messageElement = document.createElement("div");
    messageElement.className = isOwnMessage ? "message own-message" : "message";
    messageElement.style.maxWidth = "70%";
    messageElement.style.padding = "8px 12px";
    messageElement.style.borderRadius = "18px";
    messageElement.style.position = "relative";
    messageElement.style.wordBreak = "break-word";

    // Different styles for own messages vs others' messages
    if (isOwnMessage) {
      messageElement.style.backgroundColor = "#0084ff";
      messageElement.style.color = "white";
      messageElement.style.borderBottomRightRadius = "4px";
    } else {
      messageElement.style.backgroundColor = "#f0f0f0";
      messageElement.style.color = "#333";
      messageElement.style.borderBottomLeftRadius = "4px";
    }

    // Add message text
    messageElement.textContent = text;

    // Add message timestamp
    const timeElement = document.createElement("div");
    timeElement.className = "message-time";
    
    // Use provided timestamp or current time
    let messageTime;
    if (timestamp) {
      messageTime = new Date(timestamp);
    } else {
      messageTime = new Date();
    }
    
    timeElement.textContent = `${messageTime
      .getHours()
      .toString()
      .padStart(2, "0")}:${messageTime
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    timeElement.style.fontSize = "10px";
    timeElement.style.marginTop = "3px";
    timeElement.style.color = "#000000"; // Black color for all timestamps

    // Insert elements into container
    messageContainer.appendChild(messageElement);
    messageContainer.appendChild(timeElement);

    // Add container to chat
    chatMessages.appendChild(messageContainer);

    // Scroll to latest message
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  /**
   * Opens a chat with a specific user
   * @param {string} username - Username to chat with
   */
  function openChat(username) {
    activeChatUser = username;

    // Update chat header
    const chatHeader = document.querySelector(".chat-header h2");
    if (chatHeader) {
      chatHeader.textContent = username;
    }

    // Clear previous messages
    const chatMessages = document.querySelector(".chat-messages");
    if (chatMessages) {
      chatMessages.innerHTML = "";
    }

    // Show chat interface
    const activeChat = document.getElementById("active-chat");
    if (activeChat) {
      activeChat.style.display = "flex";
    }

    // Load message history
    loadMessageHistory(username);

    // Remove unread message indicator if present
    const chatLink = document.querySelector(
      `.chat-link[data-username="${username}"]`
    );
    if (chatLink) {
      const badge = chatLink.querySelector(".unread-badge");
      if (badge) {
        badge.remove();
      }
    }

    // Add to recent chats list
    if (!recentChats.has(username)) {
      recentChats.add(username);
      addChatToSidebar(username);
    }
  }

  /**
   * Loads message history for a specific chat
   * @param {string} username - Username to load history for
   */
  async function loadMessageHistory(username) {
    try {
      // Show loading indicator
      const chatMessages = document.querySelector(".chat-messages");
      if (chatMessages) {
        chatMessages.innerHTML =
          '<div class="loading-history">Loading messages...</div>';
      }

      const response = await fetch(
        `/get-message-history?username=${encodeURIComponent(username)}`
      );

      if (response.ok) {
        const data = await response.json();
        const { messages } = data;

        if (chatMessages) {
          // Clear previous messages
          chatMessages.innerHTML = "";

          if (messages && messages.length > 0) {
            messages.forEach((msg) => {
              // Determine if message is from current user
              const isOwnMessage = msg.from === currentUsername;
              displayMessage(msg.from, msg.text, isOwnMessage, msg.timestamp);
            });

            // Scroll to latest message
            chatMessages.scrollTop = chatMessages.scrollHeight;
          } else {
            // If no messages exist, show placeholder
            const emptyState = document.createElement("div");
            emptyState.className = "empty-chat-state";
            emptyState.style.textAlign = "center";
            emptyState.style.color = "#888";
            emptyState.style.padding = "20px";
            emptyState.style.margin = "auto";

            emptyState.innerHTML = `
              <div style="font-size: 48px; margin-bottom: 10px;">💬</div>
              <p>Start chatting with ${username}</p>
            `;

            chatMessages.appendChild(emptyState);
          }
        }
      } else {
        console.error("Failed to load message history");
        showNotification(
          "Error",
          "Failed to load message history",
          "error"
        );
      }
    } catch (error) {
      console.error("Error loading message history:", error);
      showNotification(
        "Error",
        "Failed to load message history",
        "error"
      );
    }
  }

  /**
   * Adds a chat to the sidebar
   * @param {string} username - Username to add to sidebar
   */
  function addChatToSidebar(username) {
    // Skip adding if this is the current user or chat already exists
    if (
      username === currentUsername ||
      document.querySelector(`.chat-link[data-username="${username}"]`)
    ) {
      return;
    }

    // Get user's avatar
    fetchUserAvatar(username).then((avatarId) => {
      const listItem = document.createElement("li");

      const chatLink = document.createElement("a");
      chatLink.href = "#";
      chatLink.className = "chat-link";
      chatLink.dataset.username = username;
      chatLink.addEventListener("click", (e) => {
        e.preventDefault();
        openChat(username);
      });

      const avatar = document.createElement("img");
      avatar.src = `/static/sources/avatar${avatarId}.jpg`;
      avatar.className = "chat-avatar";
      avatar.alt = `${username}'s avatar`;

      const usernameSpan = document.createElement("span");
      usernameSpan.textContent = username;

      chatLink.appendChild(avatar);
      chatLink.appendChild(usernameSpan);
      listItem.appendChild(chatLink);

      chatSidebar.appendChild(listItem);
    });
  }

  /**
   * Fetches a user's avatar ID
   * @param {string} username - Username to fetch avatar for
   * @returns {Promise<number>} - Avatar ID
   */
  async function fetchUserAvatar(username) {
    try {
      const response = await fetch(
        `/search-users?query=${encodeURIComponent(username)}`
      );
      if (response.ok) {
        const data = await response.json();
        const user = data.users.find((u) => u.username === username);
        return user ? user.avatar_id : 1;
      }
    } catch (error) {
      console.error("Error fetching user avatar:", error);
    }
    return 1; // Default avatar
  }

  /**
   * Searches for users
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Array of matching users
   */
  async function searchUsers(query) {
    if (query.length < 3) {
      return [];
    }

    try {
      const response = await fetch(
        `/search-users?query=${encodeURIComponent(query)}`
      );
      if (response.ok) {
        const data = await response.json();
        return data.users;
      }
    } catch (error) {
      console.error("Error searching users:", error);
    }

    return [];
  }

  /**
   * Displays search results
   * @param {Array} users - Array of user objects
   */
  function displaySearchResults(users) {
    // Clear previous search results
    const resultsContainer = document.querySelector(".search-results");
    if (resultsContainer) {
      resultsContainer.innerHTML = "";
    } else {
      const newResultsContainer = document.createElement("div");
      newResultsContainer.className = "search-results";
      document.querySelector(".chat-sidebar").appendChild(newResultsContainer);
    }

    // Display new results
    const resultsElement = document.querySelector(".search-results");

    if (users.length === 0) {
      resultsElement.innerHTML = "<p>No users found</p>";
      return;
    }

    users.forEach((user) => {
      const userElement = document.createElement("div");
      userElement.className = "chat-link";
      userElement.style.cursor = "pointer";
      userElement.style.marginBottom = "10px";

      const avatar = document.createElement("img");
      avatar.src = `/static/sources/avatar${user.avatar_id}.jpg`;
      avatar.className = "chat-avatar";
      avatar.alt = `${user.username}'s avatar`;

      const username = document.createElement("span");
      username.textContent = user.username;

      userElement.appendChild(avatar);
      userElement.appendChild(username);

      userElement.addEventListener("click", () => {
        openChat(user.username);
        resultsElement.innerHTML = "";
      });

      resultsElement.appendChild(userElement);
    });
  }

  /**
   * Toggles avatar options modal display
   */
  function toggleUserModal() {
    if (!userModal) return;

    userModal.style.display =
      userModal.style.display === "block" ? "none" : "block";
  }

  /**
   * Opens avatar selection modal
   * Allows changing user avatar
   */
  function changeAvatar() {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.style.display = "block";
    document.body.appendChild(overlay);

    // Create modal window
    const modalContent = document.createElement("div");
    modalContent.className = "modal-content-block";
    modalContent.style.display = "block";

    // Create title
    const title = document.createElement("h2");
    title.textContent = "Select Avatar";
    modalContent.appendChild(title);

    // Create avatar grid
    const avatarGrid = document.createElement("div");
    avatarGrid.className = "avatar-grid";

    // Add avatars to grid
    for (let i = 1; i <= 20; i++) {
      const avatarItem = document.createElement("div");
      avatarItem.className = "avatar-item";
      if (i === currentAvatarId) {
        avatarItem.classList.add("selected");
      }
      avatarItem.dataset.avatarId = i;

      const avatar = document.createElement("img");
      avatar.src = `/static/sources/avatar${i}.jpg`;
      avatar.alt = `Avatar ${i}`;

      avatarItem.appendChild(avatar);
      avatarGrid.appendChild(avatarItem);

      // Add click handler for avatar selection
      avatarItem.addEventListener("click", function () {
        const selectedAvatarId = i;

        // Highlight selected avatar
        const allAvatars = document.querySelectorAll(".avatar-item");
        allAvatars.forEach((item) => {
          item.classList.remove("selected");
        });
        avatarItem.classList.add("selected");

        // Send request to update avatar
        fetch("/update-avatar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ avatar_id: selectedAvatarId }),
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.message) {
              // Update global variable
              currentAvatarId = selectedAvatarId;

              // Update avatar in UI
              const userAvatar = document.querySelector(".avatar");
              if (userAvatar) {
                userAvatar.src = `/static/sources/avatar${selectedAvatarId}.jpg`;
              }

              // Close modal after successful update
              document.body.removeChild(overlay);
              document.body.removeChild(modalContent);

              showNotification("Success", "Avatar successfully changed", "info");
            } else {
              console.error("Error updating avatar:", data.error);
              showNotification(
                "Error",
                data.error || "Failed to change avatar",
                "error"
              );
            }
          })
          .catch((error) => {
            console.error("Error updating avatar:", error);
            showNotification("Error", "Failed to change avatar", "error");
          });
      });
    }

    modalContent.appendChild(avatarGrid);

    // Add close button
    const closeButton = document.createElement("button");
    closeButton.className = "close-button";
    closeButton.textContent = "Close";

    closeButton.addEventListener("click", function () {
      document.body.removeChild(overlay);
      document.body.removeChild(modalContent);
    });

    modalContent.appendChild(closeButton);
    document.body.appendChild(modalContent);

    // Close modal when clicking overlay
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) {
        document.body.removeChild(overlay);
        document.body.removeChild(modalContent);
      }
    });
  }

  /**
   * Shows invite codes modal
   * Displays user's invitation codes
   */
  function showInviteCodes() {
    fetch("/get-invite-codes")
      .then((response) => response.json())
      .then((data) => {
        // Create overlay
        const overlay = document.createElement("div");
        overlay.className = "overlay";
        overlay.style.display = "block";
        document.body.appendChild(overlay);

        // Create modal window
        const modalContent = document.createElement("div");
        modalContent.className = "modal-content-block";
        modalContent.style.display = "block";

        // Title
        const title = document.createElement("h2");
        title.textContent = "Invitation Codes";
        modalContent.appendChild(title);

        // Description
        const description = document.createElement("p");
        description.textContent =
          "Each user receives two invitation codes. You can share them with anyone. If someone who used your code deletes their account, you'll receive a new code.";
        modalContent.appendChild(description);

        // Container for invite codes
        const codesContainer = document.createElement("div");
        codesContainer.className = "invite-codes-container";

        // First code
        const codeContainer1 = document.createElement("div");
        codeContainer1.className = "invite-code-container";

        const codeLabel1 = document.createElement("label");
        codeLabel1.textContent = "Invitation Code 1:";
        codeContainer1.appendChild(codeLabel1);

        const codeInputWrapper1 = document.createElement("div");
        codeInputWrapper1.className = "code-input-wrapper";

        const codeInput1 = document.createElement("input");
        codeInput1.className = "code-input";
        codeInput1.value = data.code1;
        codeInput1.readOnly = true;
        codeInputWrapper1.appendChild(codeInput1);

        const copyButton1 = document.createElement("button");
        copyButton1.className = "copy-button";
        copyButton1.textContent = "Copy";
        copyButton1.addEventListener("click", function () {
          codeInput1.select();
          document.execCommand("copy");
          showNotification(
            "Copied",
            "Code copied to clipboard",
            "info"
          );
        });
        codeInputWrapper1.appendChild(copyButton1);

        codeContainer1.appendChild(codeInputWrapper1);
        codesContainer.appendChild(codeContainer1);

        // Second code
        const codeContainer2 = document.createElement("div");
        codeContainer2.className = "invite-code-container";

        const codeLabel2 = document.createElement("label");
        codeLabel2.textContent = "Invitation Code 2:";
        codeContainer2.appendChild(codeLabel2);

        const codeInputWrapper2 = document.createElement("div");
        codeInputWrapper2.className = "code-input-wrapper";

        const codeInput2 = document.createElement("input");
        codeInput2.className = "code-input";
        codeInput2.value = data.code2;
        codeInput2.readOnly = true;
        codeInputWrapper2.appendChild(codeInput2);

        const copyButton2 = document.createElement("button");
        copyButton2.className = "copy-button";
        copyButton2.textContent = "Copy";
        copyButton2.addEventListener("click", function () {
          codeInput2.select();
          document.execCommand("copy");
          showNotification(
            "Copied",
            "Code copied to clipboard",
            "info"
          );
        });
        codeInputWrapper2.appendChild(copyButton2);

        codeContainer2.appendChild(codeInputWrapper2);
        codesContainer.appendChild(codeContainer2);

        modalContent.appendChild(codesContainer);

        // Close button
        const closeButton = document.createElement("button");
        closeButton.className = "close-button";
        closeButton.textContent = "Close";
        closeButton.addEventListener("click", function () {
          document.body.removeChild(overlay);
          document.body.removeChild(modalContent);
        });
        modalContent.appendChild(closeButton);

        document.body.appendChild(modalContent);

        // Close on overlay click
        overlay.addEventListener("click", function (event) {
          if (event.target === overlay) {
            document.body.removeChild(overlay);
            document.body.removeChild(modalContent);
          }
        });
      })
      .catch((error) => {
        console.error("Error getting invitation codes:", error);
        showNotification("Error", "Failed to get invitation codes", "error");
      });
  }

  /**
   * Shows account deletion confirmation modal
   * Allows user to delete their account
   */
  function deleteAccount() {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.style.display = "block";
    document.body.appendChild(overlay);

    // Create modal window
    const modalContent = document.createElement("div");
    modalContent.className = "modal-content-block delete-confirm";
    modalContent.style.display = "block";

    // Title
    const title = document.createElement("h2");
    title.textContent = "Are you sure you want to delete your account?";
    modalContent.appendChild(title);

    // Description
    const description = document.createElement("p");
    description.textContent =
      "This action is irreversible. All your data will be deleted, " +
      "and the user who invited you will receive a new invitation code.";
    modalContent.appendChild(description);

    // Button container
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "button-container";
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "center";
    buttonContainer.style.gap = "15px";
    buttonContainer.style.marginTop = "20px";

    // Cancel button
    const cancelButton = document.createElement("button");
    cancelButton.className = "close-button think-button";
    cancelButton.textContent = "Cancel";
    cancelButton.style.backgroundColor = "#6c757d";
    cancelButton.addEventListener("click", function () {
      document.body.removeChild(overlay);
      document.body.removeChild(modalContent);
    });
    buttonContainer.appendChild(cancelButton);

    // Delete button
    const deleteButton = document.createElement("button");
    deleteButton.className = "close-button delete-button";
    deleteButton.style.backgroundColor = "#d9534f";
    deleteButton.textContent = "Delete Account";
    deleteButton.addEventListener("click", function () {
      // Show loading indicator
      deleteButton.textContent = "Deleting...";
      deleteButton.disabled = true;

      fetch("/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((response) => {
          if (response.ok) {
            // On successful deletion, show message and redirect to login page
            const successMessage = document.createElement("div");
            successMessage.style.position = "fixed";
            successMessage.style.top = "50%";
            successMessage.style.left = "50%";
            successMessage.style.transform = "translate(-50%, -50%)";
            successMessage.style.backgroundColor = "#5cb85c";
            successMessage.style.color = "white";
            successMessage.style.padding = "20px";
            successMessage.style.borderRadius = "5px";
            successMessage.style.zIndex = "2000";
            successMessage.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
            successMessage.textContent =
              "Account successfully deleted. Redirecting...";

            document.body.appendChild(successMessage);

            // Redirect to login page after 2 seconds
            setTimeout(() => {
              window.location.href = "/";
            }, 2000);
          } else {
            return response.json().then((data) => {
              throw new Error(data.error || "Error deleting account");
            });
          }
        })
        .catch((error) => {
          alert(`Error: ${error.message}`);
          console.error("Error:", error);

          // Restore button in case of error
          deleteButton.textContent = "Delete Account";
          deleteButton.disabled = false;
        });
    });
    buttonContainer.appendChild(deleteButton);

    modalContent.appendChild(buttonContainer);
    document.body.appendChild(modalContent);

    // Close on overlay click
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) {
        document.body.removeChild(overlay);
        document.body.removeChild(modalContent);
      }
    });
  }

  /**
   * Logs out the current user
   * Disconnects socket and redirects to login page
   */
  function logout() {
    // Show loading indicator
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.style.display = "block";
    document.body.appendChild(overlay);

    const loadingMessage = document.createElement("div");
    loadingMessage.className = "loading-message";
    loadingMessage.textContent = "Logging out...";
    loadingMessage.style.position = "fixed";
    loadingMessage.style.top = "50%";
    loadingMessage.style.left = "50%";
    loadingMessage.style.transform = "translate(-50%, -50%)";
    loadingMessage.style.backgroundColor = "white";
    loadingMessage.style.padding = "20px";
    loadingMessage.style.borderRadius = "5px";
    loadingMessage.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
    loadingMessage.style.zIndex = "2000";
    document.body.appendChild(loadingMessage);

    // Close Socket.IO connection
    if (socket && socket.connected) {
      socket.disconnect();
    }

    // Send logout request
    fetch("/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error("Error logging out");
        }
      })
      .then(() => {
        // Redirect to login page
        window.location.href = "/";
      })
      .catch((error) => {
        console.error("Logout error:", error);
        // Even with error, redirect to login page
        setTimeout(() => {
          window.location.href = "/";
        }, 1000);
      });
  }
});