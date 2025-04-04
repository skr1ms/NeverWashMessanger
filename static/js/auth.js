// Form elements
const authForm = document.getElementById("auth-form");
const regForm = document.getElementById("reg-form");
const switchToSignUp = document.querySelector(".switch-to-signup");
const switchToSignIn = document.querySelector(".switch-to-signin");

// Function to add password visibility toggle buttons
function addPasswordToggle() {
  // Find all password fields
  const passwordFields = [
    document.getElementById("password"),
    document.getElementById("new-password"),
    document.getElementById("auth-code"),
  ];

  // Add toggle button for each password field
  passwordFields.forEach((field) => {
    if (field) {
      // Create a parent container for the field and button
      const wrapper = document.createElement("div");
      wrapper.className = "password-field-wrapper";
      wrapper.style.position = "relative";
      wrapper.style.width = "95%";
      wrapper.style.margin = "10px auto";

      // Insert wrapper in place of the input field
      field.parentNode.insertBefore(wrapper, field);
      wrapper.appendChild(field);

      // Create password visibility toggle button
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "toggle-password-btn";

      // SVG eye icon
      toggleBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
    `;

      // Styles for the toggle button
      toggleBtn.style.position = "absolute";
      toggleBtn.style.right = "5px";
      toggleBtn.style.top = "50%";
      toggleBtn.style.transform = "translateY(-50%)";
      toggleBtn.style.width = "30px";
      toggleBtn.style.height = "30px";
      toggleBtn.style.padding = "0";
      toggleBtn.style.backgroundColor = "transparent"; // Set transparent background
      toggleBtn.style.color = "currentColor"; // Use current text color
      toggleBtn.style.border = "none";
      toggleBtn.style.borderRadius = "50%";
      toggleBtn.style.cursor = "pointer";
      toggleBtn.style.display = "flex";
      toggleBtn.style.justifyContent = "center";
      toggleBtn.style.alignItems = "center";

      // Add event listener for the toggle button
      toggleBtn.addEventListener("click", function () {
        if (field.type === "password") {
          field.type = "text";
          toggleBtn.style.opacity = "0.7";
        } else {
          field.type = "password";
          toggleBtn.style.opacity = "1";
        }
      });

      // Adjust input field style
      field.style.width = "100%";
      field.style.paddingRight = "40px";
      field.style.margin = "0";

      // Add button to wrapper
      wrapper.appendChild(toggleBtn);
    }
  });
}

// Call function after DOM is loaded
document.addEventListener("DOMContentLoaded", addPasswordToggle);

// Switch to registration form
switchToSignUp.addEventListener("click", () => {
  authForm.style.display = "none"; // Hide login form
  regForm.style.display = "flex"; // Show registration form
});

// Switch to login form
switchToSignIn.addEventListener("click", () => {
  regForm.style.display = "none"; // Hide registration form
  authForm.style.display = "flex"; // Show login form
});

// Function to validate username
function validateUsername(username) {
  return username.startsWith('@');
}

// Function to validate password
function validatePassword(password) {
  const minLength = 8;
  const specialChars = /[!@#$%^&*(),.?":{}|<>]/;
  return password.length >= minLength && specialChars.test(password);
}

// Function to display error message
function showError(message) {
  const errorElement = document.getElementById("error-message");
  errorElement.textContent = message;
  errorElement.style.display = "block";
}

// Handle login form submission
authForm.addEventListener("submit", function (e) {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  // Validate username
  if (!validateUsername(username)) {
    showError("Username must start with @");
    return;
  }

  fetch("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.message) {
        window.location.href = "/chat"; // Redirect to chat page
      } else {
        showError(data.error);
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      showError("An error occurred. Please try again.");
    });
});

// Handle registration form submission
regForm.addEventListener("submit", function (e) {
  e.preventDefault();

  const newUsername = document.getElementById("new-username").value;
  const newPassword = document.getElementById("new-password").value;
  const authCode = document.getElementById("auth-code").value;

  // Validate username
  if (!validateUsername(newUsername)) {
    showError("Username must start with @");
    return;
  }

  // Validate password
  if (!validatePassword(newPassword)) {
    showError("Password must be at least 8 characters long and contain at least 1 special character");
    return;
  }

  fetch("/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: newUsername,
      password: newPassword,
      invite_code: authCode,
    }),
  })
    .then((response) => {
      // Check for successful response
      if (response.ok) {
        return response.json().then(data => {
          showError("Registration is successful!");
          setTimeout(() => {
            regForm.style.display = "none";
            authForm.style.display = "flex";
          }, 1500);
          return data;
        });
      } else {
        // Handle HTTP errors
        return response.json().then(data => {
          showError(data.error || "Registration failed");
          throw new Error(data.error || "Registration failed");
        });
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    });
});