from flask import Flask
from flask_socketio import SocketIO
from config import Config

# Import modules
from auth.routes import auth_bp
from chat.routes import chat_bp
from database.connection import init_db
from chat.socket import setup_socketio

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(chat_bp)
    
    # Initialize database
    init_db()
    
    # Initialize SocketIO
    socketio = SocketIO(app, cors_allowed_origins="*")
    setup_socketio(socketio)
    
    return app, socketio

app, socketio = create_app()
if __name__ == '__main__':
    socketio.run(app, host='127.0.0.1', port=5000, debug=True, allow_unsafe_werkzeug=True)