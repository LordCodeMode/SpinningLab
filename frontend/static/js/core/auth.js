// ============================================
// FILE: static/js/core/auth.js
// UPDATED: Integrated with config.js and eventBus.js
// ============================================

import { AuthAPI } from "./api.js";
import CONFIG from './config.js';
import { eventBus, EVENTS } from './eventBus.js';

const TOKEN_KEY = CONFIG.TOKEN_STORAGE_KEY;

function notify(msg, type = "error") {
    const notification = document.getElementById("notification");
    if (!notification) {
        console.warn('[Auth] Notification element not found');
        return;
    }
    
    const icon = notification.querySelector(".notification-icon");
    const message = notification.querySelector(".notification-message");
    
    // Set content
    if (message) {
        message.textContent = typeof msg === "string" ? msg : JSON.stringify(msg);
    }
    
    // Set icon based on type
    if (icon) {
        icon.textContent = type === "success" ? "✅" : "❌";
    }
    
    // Apply classes
    notification.className = `notification ${type} show`;
    
    // Emit event
    eventBus.emit(EVENTS.NOTIFICATION, { message: msg, type });
    
    // Auto-hide after duration from config
    setTimeout(() => {
        notification.classList.remove("show");
    }, CONFIG.NOTIFICATION_DURATION);
}

// Tab switching functionality
function showTab(tabName) {
    // Update tab buttons
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.remove("active");
        if (btn.getAttribute("data-tab") === tabName) {
            btn.classList.add("active");
        }
    });
    
    // Update tab content
    document.querySelectorAll(".tab-content").forEach(content => {
        content.classList.remove("active");
    });
    
    const tabContent = document.getElementById(`${tabName}-tab`);
    if (tabContent) {
        tabContent.classList.add("active");
    }
}

// Setup tab click handlers
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const tabName = btn.getAttribute("data-tab");
        showTab(tabName);
    });
});

// Check if already logged in
const existingToken = localStorage.getItem(TOKEN_KEY);
if (existingToken) {
    console.log('[Auth] Existing token found, verifying...');
    AuthAPI.me()
        .then((user) => {
            console.log('[Auth] Token valid, redirecting to dashboard');
            eventBus.emit(EVENTS.AUTH_LOGIN, { user });
            window.location.href = "dashboard.html";
        })
        .catch((error) => {
            console.log('[Auth] Token invalid, clearing:', error.message);
            localStorage.removeItem(TOKEN_KEY);
            eventBus.emit(EVENTS.AUTH_ERROR, { error: error.message });
        });
}

// Register form handler
const registerForm = document.getElementById("register-form");
if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const btn = e.target.querySelector(".auth-btn");
        const btnText = btn.querySelector(".btn-text");
        const btnLoader = btn.querySelector(".btn-loader");
        
        const username = document.getElementById("register-username")?.value.trim();
        const email = document.getElementById("register-email")?.value.trim() || null;
        const name = document.getElementById("registerName")?.value.trim() || null;
        const password = document.getElementById("register-password")?.value;
        const confirm = document.getElementById("register-confirm")?.value;
        
        // Validation
        if (!username || !password) {
            return notify("Please fill in all required fields");
        }
        
        // Validate username format
        if (!CONFIG.PATTERNS.username.test(username)) {
            return notify("Username must be 3-20 characters (letters, numbers, _ or -)");
        }
        
        // Validate email if provided
        if (email && !CONFIG.PATTERNS.email.test(email)) {
            return notify("Please enter a valid email address");
        }
        
        if (password !== confirm) {
            return notify("Passwords do not match");
        }
        
        if (password.length < 6) {
            return notify("Password must be at least 6 characters");
        }

        // Show loading state
        btn.disabled = true;
        if (btnText) btnText.style.display = "none";
        if (btnLoader) btnLoader.style.display = "inline";

        try {
            console.log('[Auth] Registering user:', username, 'with name:', name);
            await AuthAPI.register(username, email, password, name);
            
            notify("Registration successful! Please login.", "success");
            showTab("login");
            
            // Clear form
            e.target.reset();
            
        } catch (err) {
            console.error("[Auth] Registration error:", err);
            notify(err.message || "Registration failed");
            eventBus.emit(EVENTS.AUTH_ERROR, { error: err.message, action: 'register' });
        } finally {
            // Hide loading state
            btn.disabled = false;
            if (btnText) btnText.style.display = "inline";
            if (btnLoader) btnLoader.style.display = "none";
        }
    });
}

// Login form handler
const loginForm = document.getElementById("login-form");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const btn = e.target.querySelector(".auth-btn");
        const btnText = btn.querySelector(".btn-text");
        const btnLoader = btn.querySelector(".btn-loader");
        
        const username = document.getElementById("login-username")?.value.trim();
        const password = document.getElementById("login-password")?.value;
        
        // Validation
        if (!username || !password) {
            return notify("Please enter both username and password");
        }

        // Show loading state
        btn.disabled = true;
        if (btnText) btnText.style.display = "none";
        if (btnLoader) btnLoader.style.display = "inline";

        try {
            console.log('[Auth] Logging in user:', username);
            const res = await AuthAPI.login(username, password);
            console.log("[Auth] Login response received");
            
            const token = res?.access_token || res?.token;
            if (!token) {
                throw new Error("No access token received from server");
            }
            
            // Store token
            localStorage.setItem(TOKEN_KEY, token);
            
            // Verify token immediately
            const user = await AuthAPI.me();
            console.log('[Auth] Token verified, user:', user.username);
            
            notify("Login successful!", "success");
            
            // Emit login event
            eventBus.emit(EVENTS.AUTH_LOGIN, { user, token });
            
            // Redirect after brief delay
            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 1000);
            
        } catch (err) {
            console.error("[Auth] Login error:", err);
            localStorage.removeItem(TOKEN_KEY);
            notify(err.message || "Login failed");
            eventBus.emit(EVENTS.AUTH_ERROR, { error: err.message, action: 'login' });
        } finally {
            // Hide loading state
            btn.disabled = false;
            if (btnText) btnText.style.display = "inline";
            if (btnLoader) btnLoader.style.display = "none";
        }
    });
}

console.log('[Auth] Auth module initialized');