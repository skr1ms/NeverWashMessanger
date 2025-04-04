from flask import request, session
from flask_socketio import emit
from database.messages import store_message_db

# Dictionary to track active connections (key: username, value: socket_id)
active_connections = {}

def setup_socketio(socketio):
    """Configure Socket.IO event handlers"""
    @socketio.on('connect')
    def handle_connect():
        """Handle client connection"""
        print(f"Client connected: {request.sid}")

    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        print(f"Client disconnected: {request.sid}")
        
        # Find and remove the user from active connections
        for username, sid in list(active_connections.items()):
            if sid == request.sid:
                del active_connections[username]
                print(f"User {username} disconnected from WebSocket")
                break

    @socketio.on('auth')
    def handle_auth(data):
        """Handle WebSocket authentication"""
        username = data.get('username')
        if not username:
            return

        # Save the user's connection with their socket ID
        active_connections[username] = request.sid
        print(f"User {username} authenticated via WebSocket: {request.sid}")

    @socketio.on('message')
    def handle_message(data):
        """Handle message sending"""
        sender = data.get('from')
        recipient = data.get('to')
        text = data.get('text')

        if not all([sender, recipient, text]):
            return

        # Save the message in the database
        timestamp = store_message_db(sender, recipient, text)
        if timestamp:
            data['timestamp'] = timestamp

        # Send the message to the recipient if they are online
        recipient_sid = active_connections.get(recipient)
        if recipient_sid:
            emit('message', data, room=recipient_sid)
            print(f"Message sent to {recipient} (sid: {recipient_sid})")
        else:
            print(f"User {recipient} is not online, message stored only")