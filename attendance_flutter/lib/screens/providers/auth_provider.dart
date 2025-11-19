import 'package:flutter/material.dart';
import '../services/auth_service.dart';

// Enum to represent the authentication status
enum AuthStatus { Uninitialized, Authenticated, Unauthenticated }

class AuthProvider with ChangeNotifier {
  final AuthService _authService = AuthService();
  AuthStatus _status = AuthStatus.Uninitialized;
  String? _token;
  String? _role; // <-- Added role property

  // Getters for UI to access state
  AuthStatus get status => _status;
  String? get token => _token;
  String? get role => _role; // <-- Added role getter
  bool get isAuthenticated => _status == AuthStatus.Authenticated;

  AuthProvider() {
    // Check for a saved token when the app starts
    tryAutoLogin();
  }

  Future<void> tryAutoLogin() async {
    _token = await _authService.getToken();
    if (_token != null) {
      // In a real app, you'd also fetch the user's role here
      // For testing, we assume the role is lost on app restart and requires re-login
      // To keep it simple, we will just log them out if we can't determine the role.
      _status = AuthStatus.Unauthenticated; // Force re-login to get role
      _role = null;
    } else {
      _status = AuthStatus.Unauthenticated;
      _role = null;
    }
    notifyListeners();
  }

  Future<bool> login(String username, String password) async {
    final loginData = await _authService.login(username, password);

    if (loginData != null && loginData.containsKey('token') && loginData.containsKey('role')) {
      _token = loginData['token'];
      _role = loginData['role'];
      _status = AuthStatus.Authenticated;
      notifyListeners();
      return true;
    }
    return false;
  }

  Future<void> logout() async {
    await _authService.logout();
    _status = AuthStatus.Unauthenticated;
    _token = null;
    _role = null;
    notifyListeners();
  }
}