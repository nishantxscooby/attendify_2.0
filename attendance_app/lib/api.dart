import 'dart:convert';
import 'dart:developer' as dev;
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

const String _apiBaseEnv = String.fromEnvironment('API_BASE_URL', defaultValue: '');
const String _facenetBaseEnv = String.fromEnvironment('FACENET_URL', defaultValue: '');

class FaceVerificationResult {
  const FaceVerificationResult({this.confidence, this.userId});

  final double? confidence;
  final String? userId;

  FaceVerificationResult copyWith({double? confidence, String? userId}) {
    return FaceVerificationResult(
      confidence: confidence ?? this.confidence,
      userId: userId ?? this.userId,
    );
  }
}

/// Thin client for the attendance backend and FaceNet verification service.
///
/// Base URLs read from compile-time environment variables `API_BASE_URL` and
/// `FACENET_URL`. When unset, the client leaves the fields blank so callers can
/// fail fast with readable errors instead of reaching unintended hosts.
class Api {
  Api({
    String? apiBaseUrl,
    String? facenetUrl,
    http.Client? client,
  })  : _apiBaseUrl = _normaliseApiBase(apiBaseUrl),
        _facenetUrl = _normaliseFacenetUrl(facenetUrl),
        _client = client ?? http.Client();

  final String _apiBaseUrl;
  final String _facenetUrl;
  final http.Client _client;

  bool get hasBackend => _apiBaseUrl.isNotEmpty;
  bool get hasFacenet => _facenetUrl.isNotEmpty;

  /// Disposes the underlying [http.Client]. Call when you own the instance.
  void dispose() => _client.close();

  Future<Map<String, dynamic>> login(String email, String password) async {
    // TODO: Replace legacy /login/ endpoint with Firebase-authenticated proxy.
    _ensureBackendConfigured('login');
    final response = await _client.post(
      _uri('/login/'),
      headers: _jsonHeaders(),
      body: jsonEncode({'username': email, 'password': password}),
    );

    final body = _tryDecodeMap(response.body);
    final token = body['access_token'] as String?;

    if (response.statusCode != 200 || token == null || token.isEmpty) {
      dev.log('LOGIN ERROR: status ${response.statusCode}, body: ${response.body}');
      throw Exception('Login failed');
    }

    return body;
  }

  Future<Map<String, dynamic>> attendanceInsights(
    String studentUsername,
    String jwt,
  ) async {
    _ensureBackendConfigured('attendanceInsights');
    final response = await _client.get(
      _uri('/students/$studentUsername/attendance/'),
      headers: _authHeaders(jwt),
    );

    if (response.statusCode != 200) {
      throw Exception('Insights request failed with status ${response.statusCode}');
    }

    final raw = _tryDecodeMap(response.body);
    final total = _asInt(raw['total_sessions'] ?? raw['total']);
    final attended = _asInt(raw['attended_sessions'] ?? raw['attended']);
    final absent = _asInt(raw['absent_sessions'] ?? raw['absent']);
    final percentage = (raw['percentage'] is num)
        ? (raw['percentage'] as num).toDouble()
        : (total == 0 ? 0.0 : attended / total * 100.0);

    return {
      ...raw,
      'total_sessions': total,
      'attended': attended,
      'attended_sessions': attended,
      'absent': absent,
      'absent_sessions': absent,
      'percentage': percentage,
    };
  }

  Future<List<dynamic>> marks(String studentUsername, String jwt) async {
    _ensureBackendConfigured('marks');
    final response = await _client.get(
      _uri('/students/$studentUsername/marks/'),
      headers: _authHeaders(jwt),
    );

    if (response.statusCode != 200) {
      throw Exception('Marks request failed with status ${response.statusCode}');
    }

    try {
      return _decodeJsonList(response.body);
    } catch (e) {
      dev.log('FETCH ERROR: $e');
      return const <dynamic>[];
    }
  }

  Future<List<dynamic>> schedule(String studentUsername, String jwt) async {
    _ensureBackendConfigured('schedule');
    final response = await _client.get(
      _uri('/students/$studentUsername/schedule/'),
      headers: _authHeaders(jwt),
    );

    if (response.statusCode != 200) {
      throw Exception('Schedule request failed with status ${response.statusCode}');
    }

    try {
      return _decodeJsonList(response.body);
    } catch (e) {
      dev.log('FETCH ERROR: $e');
      return const <dynamic>[];
    }
  }

  Future<Map<String, dynamic>> geofenceCheck(
    double lat,
    double lon,
    String jwt,
  ) async {
    _ensureBackendConfigured('geofenceCheck');
    final response = await _client.post(
      _uri('/attendance/geofence-check'),
      headers: _authHeaders(jwt),
      body: jsonEncode({'latitude': lat, 'longitude': lon}),
    );

    if (response.statusCode != 200) {
      throw Exception('Geofence check failed with status ${response.statusCode}');
    }

    return _tryDecodeMap(response.body);
  }

  Future<Map<String, dynamic>> markFace(
    String studentUsername,
    int sessionId,
    String imageB64,
    String jwt,
  ) async {
    // TODO: Point to Cloud Run attendance microservice once deployed.
    _ensureBackendConfigured('markFace');
    final response = await _client.post(
      _uri('/attendance/mark/face'),
      headers: _authHeaders(jwt),
      body: jsonEncode({
        'student_username': studentUsername,
        'session_id': sessionId,
        'image_base64': imageB64,
      }),
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Face attendance failed with status ${response.statusCode}');
    }

    return _tryDecodeMap(response.body);
  }

  /// Calls the FaceNet `/verify` endpoint with the provided [bytes].
  ///
  /// Returns a [FaceVerificationResult] containing the confidence score and the
  /// optional matched `userId`. When the FaceNet URL is missing, the method
  /// resolves with a default result so the caller can continue with a dummy
  /// confidence score.
  Future<FaceVerificationResult> verifyFace({
    required Uint8List bytes,
    String fileName = 'face.jpg',
    String contentType = 'image/jpeg',
  }) async {
    if (!hasFacenet) {
      dev.log('FACENET_URL not configured; returning default confidence');
      return const FaceVerificationResult(confidence: 0.0);
    }

    final uri = Uri.parse('$_facenetUrl/verify');
    final request = http.MultipartRequest('POST', uri)
      ..files.add(
        http.MultipartFile.fromBytes(
          'image',
          bytes,
          filename: fileName,
          contentType: MediaType.parse(contentType),
        ),
      );

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode != 200) {
      throw Exception('Face verification failed with status ${response.statusCode}');
    }

    final payload = _tryDecodeMap(response.body);
    return FaceVerificationResult(
      confidence: _asDouble(payload['confidence']),
      userId: (payload['userId'] ?? payload['matched_user_id']) as String?,
    );
  }

  Uri _uri(String path) {
    final String normalisedPath =
        path.startsWith('/') ? path : '/$path';
    return Uri.parse('$_apiBaseUrl$normalisedPath');
  }

  Map<String, String> _jsonHeaders() => const {
        'Content-Type': 'application/json',
      };

  Map<String, String> _authHeaders(String jwt) => {
        ..._jsonHeaders(),
        'Authorization': 'Bearer $jwt',
      };

  Map<String, dynamic> _decodeJsonMap(String source) {
    final dynamic decoded = jsonDecode(source);
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }
    throw Exception('Expected a JSON object but got ${decoded.runtimeType}');
  }

  List<dynamic> _decodeJsonList(String source) {
    final dynamic decoded = jsonDecode(source);
    if (decoded is List<dynamic>) {
      return decoded;
    }
    throw Exception('Expected a JSON array but got ${decoded.runtimeType}');
  }

  Map<String, dynamic> _tryDecodeMap(String source) {
    try {
      return _decodeJsonMap(source);
    } catch (e) {
      dev.log('FETCH ERROR: $e');
      return <String, dynamic>{};
    }
  }

  void _ensureBackendConfigured(String operation) {
    if (hasBackend) return;
    throw StateError('API_BASE_URL is not configured for $operation');
  }
}

String _normaliseApiBase(String? override) {
  final candidate = (override ?? _apiBaseEnv).trim();
  if (candidate.isEmpty) {
    return '';
  }
  return candidate.endsWith('/') ? candidate.substring(0, candidate.length - 1) : candidate;
}

String _normaliseFacenetUrl(String? override) {
  final candidate = (override ?? _facenetBaseEnv).trim();
  if (candidate.isEmpty) {
    return '';
  }
  return candidate.endsWith('/') ? candidate.substring(0, candidate.length - 1) : candidate;
}

int _asInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}

double? _asDouble(dynamic value) {
  if (value == null) return null;
  if (value is double) return value;
  if (value is int) return value.toDouble();
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}
