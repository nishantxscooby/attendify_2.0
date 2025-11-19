// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:firebase_auth_mocks/firebase_auth_mocks.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:attendance_app/main.dart';
import 'package:attendance_app/providers/auth_provider.dart';
import 'package:attendance_app/screens/mark_attendance.dart';
import 'package:attendance_app/services/firestore_service.dart';

void main() {
  testWidgets(
    'renders login screen',
    (WidgetTester tester) async {
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider(create: (_) => AuthProvider()),
          ],
          child: const AttendanceApp(),
        ),
      );

      expect(find.text('Login'), findsOneWidget);
      expect(find.widgetWithText(ElevatedButton, 'Sign in'), findsOneWidget);
      expect(find.byType(TextField), findsNWidgets(2));
    },
    skip: true, // TODO: Provide Firebase mocks for widget tests.
  );

  testWidgets('MarkAttendanceScreen shows records from Firestore stream', (tester) async {
    final fakeStore = FakeFirebaseFirestore();
    await fakeStore.collection('attendance').add({
      'sessionId': 'session-1',
      'userId': 'test-user',
      'status': 'present',
      'capturedAt': Timestamp.fromDate(DateTime.now()),
    });
    final service = FirestoreService(firestore: fakeStore);
    final auth = await _buildAuthProvider(store: fakeStore, service: service);

    await tester.pumpWidget(_wrapWithProviders(service: service, auth: auth));
    await tester.pump();

    expect(find.textContaining('User: test-user'), findsOneWidget);
  });

  testWidgets('tapping Mark Present writes attendance record once', (tester) async {
    final fakeStore = FakeFirebaseFirestore();
    final recordingService = RecordingFirestoreService(fakeStore);
    final auth = await _buildAuthProvider(store: fakeStore, service: recordingService);

    await tester.pumpWidget(_wrapWithProviders(service: recordingService, auth: auth));
    await tester.pump();

    expect(recordingService.createCalls, 0);

    await tester.tap(find.widgetWithText(ElevatedButton, 'Mark Present'));
    await tester.pumpAndSettle();

    expect(recordingService.createCalls, 1);
  });
}

class RecordingFirestoreService extends FirestoreService {
  RecordingFirestoreService(this.store) : super(firestore: store);

  final FakeFirebaseFirestore store;
  int createCalls = 0;

  @override
  Stream<List<AttendanceRecord>> attendanceBySession(String sessionId) {
    return const Stream<List<AttendanceRecord>>.value(<AttendanceRecord>[]);
  }

  @override
  Future<String> createOrUpdateAttendanceRecord(AttendanceRecord record) async {
    createCalls += 1;
    return 'stub-id';
  }
}

Future<AuthProvider> _buildAuthProvider({
  required FakeFirebaseFirestore store,
  required FirestoreService service,
}) async {
  const uid = 'test-user';
  await store.collection('users').doc(uid).set({
    'email': 'test@example.com',
    'role': 'teacher',
  });

  final mockAuth = MockFirebaseAuth(
    mockUser: MockUser(uid: uid, email: 'test@example.com'),
  );
  return AuthProvider(
    auth: mockAuth,
    firestore: store,
    firestoreService: service,
  );
}

Widget _wrapWithProviders({
  required FirestoreService service,
  required AuthProvider auth,
}) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<AuthProvider>.value(value: auth),
      Provider<FirestoreService>.value(value: service),
    ],
    child: const MaterialApp(
      home: MarkAttendanceScreen(sessionId: 'session-1', organizationId: 'org-1'),
    ),
  );
}

testWidgets('MarkAttendanceScreen shows records from Firestore stream', (tester) async {
  final fakeStore = FakeFirebaseFirestore();
  await fakeStore.collection('attendance').add({
    'sessionId': 'session-1',
    'userId': 'test-user',
    'status': 'present',
    'capturedAt': Timestamp.fromDate(DateTime.now()),
  });
  final service = FirestoreService(firestore: fakeStore);
  final auth = await _buildAuthProvider(store: fakeStore, service: service);

  await tester.pumpWidget(_wrapWithProviders(service: service, auth: auth));
  await tester.pump();

  expect(find.textContaining('User: test-user'), findsOneWidget);
});

testWidgets('tapping Mark Present writes attendance record once', (tester) async {
  final fakeStore = FakeFirebaseFirestore();
  final recordingService = RecordingFirestoreService(fakeStore);
  final auth = await _buildAuthProvider(store: fakeStore, service: recordingService);

  await tester.pumpWidget(_wrapWithProviders(service: recordingService, auth: auth));
  await tester.pump();

  expect(recordingService.createCalls, 0);

  await tester.tap(find.widgetWithText(ElevatedButton, 'Mark Present'));
  await tester.pumpAndSettle();

  expect(recordingService.createCalls, 1);
});
