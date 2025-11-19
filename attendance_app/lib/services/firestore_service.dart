import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/foundation.dart';

@immutable
class Organization {
  const Organization({
    required this.id,
    this.name,
    this.metadata,
  });

  final String id;
  final String? name;
  final Map<String, dynamic>? metadata;

  Map<String, dynamic> toMap() => {
        if (name != null) 'name': name,
        if (metadata != null) 'metadata': metadata,
      };

  factory Organization.fromSnapshot(
    DocumentSnapshot<Map<String, dynamic>> snapshot,
  ) {
    final data = snapshot.data() ?? <String, dynamic>{};
    return Organization(
      id: snapshot.id,
      name: data['name'] as String?,
      metadata: (data['metadata'] as Map<String, dynamic>?)?.map(
        (key, value) => MapEntry(key, value),
      ),
    );
  }
}

@immutable
class AppUser {
  const AppUser({
    required this.id,
    required this.email,
    this.displayName,
    this.organizationId,
    this.role,
    this.photoUrl,
  });

  final String id;
  final String email;
  final String? displayName;
  final String? organizationId;
  final String? role;
  final String? photoUrl;

  Map<String, dynamic> toMap() => {
        'email': email,
        if (displayName != null) 'displayName': displayName,
        if (organizationId != null) 'organizationId': organizationId,
        if (role != null) 'role': role,
        if (photoUrl != null) 'photoUrl': photoUrl,
      };

  factory AppUser.fromSnapshot(
    DocumentSnapshot<Map<String, dynamic>> snapshot,
  ) {
    final data = snapshot.data() ?? <String, dynamic>{};
    return AppUser(
      id: snapshot.id,
      email: data['email'] as String? ?? '',
      displayName: data['displayName'] as String?,
      organizationId: data['organizationId'] as String?,
      role: data['role'] as String?,
      photoUrl: data['photoUrl'] as String?,
    );
  }
}

@immutable
class Classroom {
  const Classroom({
    required this.id,
    this.organizationId,
    this.name,
    this.metadata,
  });

  final String id;
  final String? organizationId;
  final String? name;
  final Map<String, dynamic>? metadata;

  Map<String, dynamic> toMap() => {
        if (organizationId != null) 'organizationId': organizationId,
        if (name != null) 'name': name,
        if (metadata != null) 'metadata': metadata,
      };

  factory Classroom.fromSnapshot(
    DocumentSnapshot<Map<String, dynamic>> snapshot,
  ) {
    final data = snapshot.data() ?? <String, dynamic>{};
    return Classroom(
      id: snapshot.id,
      organizationId: data['organizationId'] as String?,
      name: data['name'] as String?,
      metadata: (data['metadata'] as Map<String, dynamic>?)?.map(
        (key, value) => MapEntry(key, value),
      ),
    );
  }
}

@immutable
class ClassSession {
  const ClassSession({
    required this.id,
    required this.classId,
    this.startsAt,
    this.endsAt,
    this.instructorId,
    this.location,
    this.metadata,
  });

  final String id;
  final String classId;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final String? instructorId;
  final String? location;
  final Map<String, dynamic>? metadata;

  Map<String, dynamic> toMap() => {
        'classId': classId,
        if (startsAt != null) 'startsAt': Timestamp.fromDate(startsAt!),
        if (endsAt != null) 'endsAt': Timestamp.fromDate(endsAt!),
        if (instructorId != null) 'instructorId': instructorId,
        if (location != null) 'location': location,
        if (metadata != null) 'metadata': metadata,
      };

  factory ClassSession.fromSnapshot(
    DocumentSnapshot<Map<String, dynamic>> snapshot,
  ) {
    final data = snapshot.data() ?? <String, dynamic>{};
    return ClassSession(
      id: snapshot.id,
      classId: data['classId'] as String? ?? '',
      startsAt: _timestampToDateTime(data['startsAt']),
      endsAt: _timestampToDateTime(data['endsAt']),
      instructorId: data['instructorId'] as String?,
      location: data['location'] as String?,
      metadata: (data['metadata'] as Map<String, dynamic>?)?.map(
        (key, value) => MapEntry(key, value),
      ),
    );
  }
}

@immutable
class AttendanceRecord {
  const AttendanceRecord({
    required this.sessionId,
    required this.userId,
    this.id,
    this.status = 'present',
    this.confidence,
    this.capturedAt,
    this.imagePath,
    this.metadata,
  });

  final String? id;
  final String sessionId;
  final String userId;
  final String status;
  final double? confidence;
  final DateTime? capturedAt;
  final String? imagePath;
  final Map<String, dynamic>? metadata;

  Map<String, dynamic> toMap({bool includeCapturedAt = false}) => {
        'sessionId': sessionId,
        'userId': userId,
        'status': status,
        if (confidence != null) 'confidence': confidence,
        if (includeCapturedAt && capturedAt != null)
          'capturedAt': Timestamp.fromDate(capturedAt!),
        if (imagePath != null) 'imagePath': imagePath,
        if (metadata != null) 'metadata': metadata,
      };

  factory AttendanceRecord.fromSnapshot(
    DocumentSnapshot<Map<String, dynamic>> snapshot,
  ) {
    final data = snapshot.data() ?? <String, dynamic>{};
    return AttendanceRecord(
      id: snapshot.id,
      sessionId: data['sessionId'] as String? ?? '',
      userId: data['userId'] as String? ?? '',
      status: data['status'] as String? ?? 'present',
      confidence: _toDouble(data['confidence']),
      capturedAt: _timestampToDateTime(data['capturedAt']),
      imagePath: data['imagePath'] as String?,
      metadata: (data['metadata'] as Map<String, dynamic>?)?.map(
        (key, value) => MapEntry(key, value),
      ),
    );
  }
}

class FirestoreService {
  FirestoreService({
    FirebaseFirestore? firestore,
    FirebaseStorage? storage,
  })  : _firestore = firestore ?? FirebaseFirestore.instance,
        _storage = storage ?? FirebaseStorage.instance;

  final FirebaseFirestore _firestore;
  final FirebaseStorage _storage;

  CollectionReference<Map<String, dynamic>> get _organizations =>
      _firestore.collection('organizations');
  CollectionReference<Map<String, dynamic>> get _users =>
      _firestore.collection('users');
  CollectionReference<Map<String, dynamic>> get _classes =>
      _firestore.collection('classes');
  CollectionReference<Map<String, dynamic>> get _sessions =>
      _firestore.collection('sessions');
  CollectionReference<Map<String, dynamic>> get _attendance =>
      _firestore.collection('attendance');

  Future<void> setOrganization(Organization organization) async {
    await _organizations
        .doc(organization.id)
        .set(organization.toMap(), SetOptions(merge: true));
  }

  Future<Organization?> fetchOrganization(String orgId) async {
    final snapshot = await _organizations.doc(orgId).get();
    if (!snapshot.exists) return null;
    return Organization.fromSnapshot(snapshot);
  }

  Stream<Organization?> watchOrganization(String orgId) {
    return _organizations.doc(orgId).snapshots().map((snapshot) {
      if (!snapshot.exists) return null;
      return Organization.fromSnapshot(snapshot);
    });
  }

  Future<void> setUser(AppUser user) async {
    await _users.doc(user.id).set(user.toMap(), SetOptions(merge: true));
  }

  Future<AppUser?> fetchUser(String userId) async {
    final snapshot = await _users.doc(userId).get();
    if (!snapshot.exists) return null;
    return AppUser.fromSnapshot(snapshot);
  }

  Stream<AppUser?> watchUser(String userId) {
    return _users.doc(userId).snapshots().map((snapshot) {
      if (!snapshot.exists) return null;
      return AppUser.fromSnapshot(snapshot);
    });
  }

  Stream<List<AppUser>> usersForOrganization(String orgId) {
    return _users
        .where('organizationId', isEqualTo: orgId)
        .snapshots()
        .map((snapshot) =>
            snapshot.docs.map(AppUser.fromSnapshot).toList(growable: false));
  }

  Future<void> setClassroom(Classroom classroom) async {
    await _classes
        .doc(classroom.id)
        .set(classroom.toMap(), SetOptions(merge: true));
  }

  Future<Classroom?> fetchClassroom(String classId) async {
    final snapshot = await _classes.doc(classId).get();
    if (!snapshot.exists) return null;
    return Classroom.fromSnapshot(snapshot);
  }

  Stream<Classroom?> watchClassroom(String classId) {
    return _classes.doc(classId).snapshots().map((snapshot) {
      if (!snapshot.exists) return null;
      return Classroom.fromSnapshot(snapshot);
    });
  }

  Stream<List<Classroom>> classroomsForOrganization(String orgId) {
    return _classes
        .where('organizationId', isEqualTo: orgId)
        .snapshots()
        .map((snapshot) =>
            snapshot.docs.map(Classroom.fromSnapshot).toList(growable: false));
  }

  Future<void> setSession(ClassSession session) async {
    await _sessions
        .doc(session.id)
        .set(session.toMap(), SetOptions(merge: true));
  }

  Future<ClassSession?> fetchSession(String sessionId) async {
    final snapshot = await _sessions.doc(sessionId).get();
    if (!snapshot.exists) return null;
    return ClassSession.fromSnapshot(snapshot);
  }

  Stream<ClassSession?> watchSession(String sessionId) {
    return _sessions.doc(sessionId).snapshots().map((snapshot) {
      if (!snapshot.exists) return null;
      return ClassSession.fromSnapshot(snapshot);
    });
  }

  Stream<List<ClassSession>> sessionsForClass(String classId) {
    return _sessions
        .where('classId', isEqualTo: classId)
        .orderBy('startsAt')
        .snapshots()
        .map((snapshot) =>
            snapshot.docs.map(ClassSession.fromSnapshot).toList(growable: false));
  }

  Future<String> createOrUpdateAttendanceRecord(AttendanceRecord record) async {
    final String docId =
        (record.id != null && record.id!.isNotEmpty) ? record.id! : _attendance.doc().id;
    final data = record.toMap();
    data['capturedAt'] = FieldValue.serverTimestamp();
    await _attendance.doc(docId).set(data, SetOptions(merge: true));
    return docId;
  }

  Future<AttendanceRecord?> fetchAttendanceRecord(String recordId) async {
    final snapshot = await _attendance.doc(recordId).get();
    if (!snapshot.exists) return null;
    return AttendanceRecord.fromSnapshot(snapshot);
  }

  Stream<List<AttendanceRecord>> attendanceBySession(String sessionId) {
    return _attendance
        .where('sessionId', isEqualTo: sessionId)
        .orderBy('capturedAt', descending: true)
        .snapshots()
        .map(
          (snapshot) => snapshot.docs
              .map(AttendanceRecord.fromSnapshot)
              .toList(growable: false),
        );
  }

  Future<void> deleteAttendanceRecord(String recordId) async {
    await _attendance.doc(recordId).delete();
  }

  Future<String> uploadFaceImage({
    required String organizationId,
    required String sessionId,
    required Uint8List bytes,
    String? userId,
    String contentType = 'image/jpeg',
  }) async {
    final sanitizedUser = (userId ?? 'unknown')
        .replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
    final truncatedUser =
        sanitizedUser.length > 48 ? sanitizedUser.substring(0, 48) : sanitizedUser;
    final fileName = '${DateTime.now().microsecondsSinceEpoch}.jpg';
    final reference = _storage
        .ref()
        .child('attendance')
        .child(organizationId)
        .child(sessionId)
        .child('${truncatedUser}_$fileName');

    final metadata = SettableMetadata(contentType: contentType);
    await reference.putData(bytes, metadata);

    return 'gs://${reference.bucket}/${reference.fullPath}';
  }
}

DateTime? _timestampToDateTime(dynamic value) {
  if (value is Timestamp) return value.toDate();
  if (value is DateTime) return value;
  if (value is num) {
    return DateTime.fromMillisecondsSinceEpoch(value.toInt());
  }
  if (value is String) {
    return DateTime.tryParse(value);
  }
  return null;
}

double? _toDouble(dynamic value) {
  if (value == null) return null;
  if (value is double) return value;
  if (value is int) return value.toDouble();
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}
