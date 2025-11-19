import 'package:attendance_app/main.dart';
import 'package:attendance_app/providers/auth_provider.dart';
import 'package:attendance_app/screens/dashboard_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

void main() {
  testWidgets(
    'successful login navigates to dashboard',
    (WidgetTester tester) async {
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider(create: (_) => AuthProvider()),
          ],
          child: const AttendanceApp(),
        ),
      );

      await tester.enterText(find.byType(TextField).at(0), 'test123');
      await tester.enterText(find.byType(TextField).at(1), 'test123');

      await tester.tap(find.widgetWithText(ElevatedButton, 'Sign in'));
      await tester.pumpAndSettle();

      expect(find.byType(DashboardScreen), findsOneWidget);
    },
    skip: true, // TODO: Set up Firebase Auth emulator/test harness.
  );
}
