import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AuthService {
  // Replace with your actual backend URL
  final String _baseUrl = "http://your_backend_ip:5000";

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('jwt_token');
  }

  Future<void> _saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('jwt_token', token);
  }

  // Updated login method for testing
  Future<Map<String, String>?> login(String username, String password) async {
    try {
      // --- START: MOCK CODE FOR TESTING ---
      // This block pretends to be the server. Remove it when your backend is ready.
      print("--- Using MOCK data for login! ---");
      await Future.delayed(Duration(seconds: 1)); // Simulate network delay

      if (username.toLowerCase().contains('admin')) {
        await _saveToken('fake_admin_token_xyz');
        return {'token': 'fake_admin_token_xyz', 'role': 'admin'};
      } else {
        await _saveToken('fake_student_token_123');
        return {'token': 'fake_student_token_123', 'role': 'student'};
      }
      // --- END: MOCK CODE FOR TESTING ---

      /*
      // Your original code to be used later
      final response = await http.post(
        Uri.parse('$_baseUrl/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': username, 'password': password}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final token = data['token'];
        final role = data['role']; // The real role from your backend
        await _saveToken(token);
        return {'token': token, 'role': role};
      }
      return null;
      */
    } catch (e) {
      print("Login Error: $e");
      return null;
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
  }
}