-- Create a table for storing messages between users
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,                           -- Auto-incrementing primary key
    sender_id INT NOT NULL REFERENCES user_data(id),  -- ID of the message sender (foreign key to user_data)
    receiver_id INT NOT NULL REFERENCES user_data(id),-- ID of the message receiver (foreign key to user_data)
    content TEXT NOT NULL,                           -- The actual message content
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP  -- When the message was sent
);

-- Create a table for storing user information
CREATE TABLE IF NOT EXISTS user_data (
    id SERIAL PRIMARY KEY,                           -- Auto-incrementing primary key
    name VARCHAR(50) NOT NULL UNIQUE CHECK (name LIKE '@%'),  -- Username must start with @
    password_hash VARCHAR(128) NOT NULL,             -- Hashed password for security
    hash_for_invite_first VARCHAR(64) UNIQUE,       -- First invite code hash
    hash_for_invite_second VARCHAR(64) UNIQUE,       -- Second invite code hash
    hash_for_invite_first_used BOOLEAN NOT NULL DEFAULT false,  -- Is first invite used?
    hash_for_invite_second_used BOOLEAN NOT NULL DEFAULT false, -- Is second invite used?
    avatar_id INT NOT NULL DEFAULT 1 CHECK (avatar_id BETWEEN 1 AND 20),  -- User avatar ID (1-20)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP  -- When user was created
);

-- Add table and column comments for user_data
COMMENT ON TABLE user_data IS 'Main table storing user information';
COMMENT ON COLUMN user_data.hash_for_invite_first IS 'User''s first invite code';
COMMENT ON COLUMN user_data.hash_for_invite_second IS 'User''s second invite code';

-- Create a table to track invite code usage
CREATE TABLE IF NOT EXISTS user_invites (
    id SERIAL PRIMARY KEY,                           -- Auto-incrementing primary key
    inviter_id INT NOT NULL,                         -- ID of user who created the invite
    invitee_id INT NOT NULL,                         -- ID of user who used the invite
    invite_hash VARCHAR(64) NOT NULL,                -- The invite hash that was used
    used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- When invite was used
    is_active BOOLEAN NOT NULL DEFAULT true,         -- Is the invite still active?

    -- Foreign key to inviter's user record
    CONSTRAINT fk_inviter FOREIGN KEY (inviter_id)
        REFERENCES user_data(id) ON DELETE CASCADE,

    -- Foreign key to invitee's user record
    CONSTRAINT fk_invitee FOREIGN KEY (invitee_id)
        REFERENCES user_data(id) ON DELETE CASCADE,

    -- Ensure each invite hash is unique
    CONSTRAINT unique_invite UNIQUE (invite_hash)
);

-- Add table and column comments for user_invites
COMMENT ON TABLE user_invites IS 'History of invite code usage';
COMMENT ON COLUMN user_invites.invite_hash IS 'The invite hash that was consumed';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_data_name ON user_data(name);           -- Index for username lookup
CREATE INDEX IF NOT EXISTS idx_user_invites_hash ON user_invites(invite_hash);  -- Index for invite hash lookup
CREATE INDEX IF NOT EXISTS idx_user_invites_inviter ON user_invites(inviter_id);  -- Index for inviter lookup

-- Create a function to reset invite hashes when a user is deleted
CREATE OR REPLACE FUNCTION reset_invite_hashes()
RETURNS TRIGGER AS $$
BEGIN
    -- When a user is deleted, mark their unused invites as available again
    UPDATE user_data
    SET
        hash_for_invite_first_used = CASE
            WHEN hash_for_invite_first = OLD.hash_for_invite_first THEN false
            ELSE hash_for_invite_first_used
        END,
        hash_for_invite_second_used = CASE
            WHEN hash_for_invite_second = OLD.hash_for_invite_second THEN false
            ELSE hash_for_invite_second_used
        END
    WHERE id IN (
        SELECT inviter_id
        FROM user_invites
        WHERE invitee_id = OLD.id
    );

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger that executes the reset function before user deletion
CREATE TRIGGER trigger_reset_invites
BEFORE DELETE ON user_data
FOR EACH ROW EXECUTE FUNCTION reset_invite_hashes();