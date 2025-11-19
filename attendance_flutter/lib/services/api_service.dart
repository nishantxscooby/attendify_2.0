import 'dart:convert';
import 'package:http/http.dart' as http;
import 'auth_service.dart'; // Import AuthService
import '../models/attendance_record.dart';

class ApiService {
  final String _baseUrl = "http://your_backend_ip:5000";
  final AuthService _authService = AuthService();

  // Helper to get authenticated headers
  Future<Map<String, String>> _getAuthHeaders() async {
    final token = await _authService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  Future<List<AttendanceRecord>?> getAttendance(String studentId) async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/attendance/$studentId'),
        headers: await _getAuthHeaders(),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final List<dynamic> recordsJson = data['records'];
        return recordsJson.map((json) => AttendanceRecord.fromJson(json)).toList();
      }
      return null;
    } catch (e) {
      print("getAttendance Error: $e");
      return null;
    }
  }
  
  Future<bool> verifyFace(String studentId, String base64Image) async {
     try {
      final response = await http.post(
        Uri.parse('$_baseUrl/verify_face'),
        headers: {'Content-Type': 'application/json'}, // This endpoint might not need auth
        body: jsonEncode({
          'student_id': studentId,
          'image': 'data:image/jpeg;base64,$base64Image',
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['verified'] ?? false;
      }
      return false;
    } catch (e) {
      print("verifyFace Error: $e");
      return false;
    }
  }
}