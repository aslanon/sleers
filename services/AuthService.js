/**
 * AuthService.js
 * Authentication and subscription management service for Creavit Studio API
 */

const API_BASE_URL = 'https://api.creavit.studio';

/**
 * Store for authentication data
 */
let authData = null;

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
const isAuthenticated = () => {
	return authData && authData.jwt && authData.user;
};

/**
 * Get current authentication data
 * @returns {Object|null}
 */
const getAuthData = () => {
	return authData;
};

/**
 * Get user subscription status
 * @returns {string|null}
 */
const getSubscriptionStatus = () => {
	if (!authData || !authData.user) return null;
	return authData.user.subscription_status;
};

/**
 * Check if user can export (subscription status is 'trial' or 'active')
 * @returns {boolean}
 */
const canExport = () => {
	const status = getSubscriptionStatus();
	// Allow export if status is 'trial', 'trialing' or 'active', but not null or other values
	return status === 'trial' || status === 'trialing' || status === 'active';
};

/**
 * Login user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Authentication result
 */
const login = async (email, password) => {
	try {
		console.log('[AuthService] Attempting login for:', email);
		
		const response = await fetch(`${API_BASE_URL}/api/auth/local`, {
			method: 'POST',
			headers: {
				'accept': '*/*',
				'accept-language': 'en,tr;q=0.9,de;q=0.8,it;q=0.7,en-US;q=0.6',
				'content-type': 'application/json',
				'origin': 'http://localhost:3002',
				'user-agent': 'Sleer/1.0'
			},
			body: JSON.stringify({
				identifier: email,
				password: password
			})
		});

		const data = await response.json();

		if (!response.ok) {
			// Handle API error response format
			const errorMessage = data.error?.message || `Login failed: ${response.status}`;
			throw new Error(errorMessage);
		}

		// Check if login was successful (data should contain jwt and user)
		if (!data.jwt || !data.user) {
			throw new Error(data.error?.message || 'Login failed: Invalid response format');
		}
		
		// Store authentication data
		authData = data;
		
		// Store in electron-store for persistence
		if (window.electron && window.electron.ipcRenderer) {
			await window.electron.ipcRenderer.invoke('STORE_AUTH_DATA', data);
		}

		console.log('[AuthService] Login successful for user:', data.user.email);
		console.log('[AuthService] Subscription status:', data.user.subscription_status);
		
		return {
			success: true,
			user: data.user,
			canExport: canExport()
		};

	} catch (error) {
		console.error('[AuthService] Login error:', error);
		return {
			success: false,
			error: error.message
		};
	}
};

/**
 * Logout user and clear authentication data
 */
const logout = async () => {
	authData = null;
	
	// Clear from electron-store
	if (window.electron && window.electron.ipcRenderer) {
		await window.electron.ipcRenderer.invoke('CLEAR_AUTH_DATA');
	}
	
	console.log('[AuthService] User logged out');
};

/**
 * Initialize authentication service (restore from storage)
 */
const init = async () => {
	try {
		if (window.electron && window.electron.ipcRenderer) {
			const storedAuth = await window.electron.ipcRenderer.invoke('GET_AUTH_DATA');
			if (storedAuth && storedAuth.jwt && storedAuth.user) {
				authData = storedAuth;
				console.log('[AuthService] Restored authentication for user:', storedAuth.user.email);
				console.log('[AuthService] Subscription status:', storedAuth.user.subscription_status);
			}
		}
	} catch (error) {
		console.error('[AuthService] Failed to restore authentication:', error);
	}
};

/**
 * Refresh user data from /me endpoint to get updated subscription status
 * @returns {Promise<Object>} Updated user data result
 */
const refreshUserData = async () => {
	try {
		if (!authData || !authData.jwt) {
			console.log('[AuthService] No JWT token available for refresh');
			return {
				success: false,
				error: 'Not authenticated'
			};
		}

		console.log('[AuthService] Refreshing user data from /me endpoint');
		
		const response = await fetch(`${API_BASE_URL}/api/users/me`, {
			method: 'GET',
			headers: {
				'accept': '*/*',
				'accept-language': 'en,tr;q=0.9,de;q=0.8,it;q=0.7,en-US;q=0.6',
				'authorization': `Bearer ${authData.jwt}`,
				'origin': 'http://localhost:3002',
				'user-agent': 'Sleer/1.0'
			}
		});

		const data = await response.json();

		if (!response.ok) {
			const errorMessage = data.error?.message || `Failed to refresh user data: ${response.status}`;
			console.error('[AuthService] Refresh failed:', errorMessage);
			return {
				success: false,
				error: errorMessage
			};
		}

		// Update stored auth data with fresh user info
		authData.user = data;
		
		// Update in electron-store for persistence
		if (window.electron && window.electron.ipcRenderer) {
			await window.electron.ipcRenderer.invoke('STORE_AUTH_DATA', authData);
		}

		console.log('[AuthService] User data refreshed successfully');
		console.log('[AuthService] Updated subscription status:', data.subscription_status);
		
		return {
			success: true,
			user: data,
			canExport: data.subscription_status === 'trial' || data.subscription_status === 'trialing' || data.subscription_status === 'active'
		};

	} catch (error) {
		console.error('[AuthService] Refresh error:', error);
		return {
			success: false,
			error: error.message
		};
	}
};

/**
 * Open register page in system browser
 */
const openRegister = async () => {
	try {
		if (window.electron && window.electron.ipcRenderer) {
			await window.electron.ipcRenderer.invoke('OPEN_EXTERNAL_URL', 'https://creavit.studio/register');
		}
	} catch (error) {
		console.error('[AuthService] Failed to open register URL:', error);
	}
};

export default {
	isAuthenticated,
	getAuthData,
	getSubscriptionStatus,
	canExport,
	login,
	logout,
	init,
	refreshUserData,
	openRegister
};