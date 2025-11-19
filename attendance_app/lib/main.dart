import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'firebase_options.dart';
import 'providers/auth_provider.dart';
import 'screens/dashboard_screen.dart';
import 'screens/login_screen.dart';
import 'screens/mark_attendance.dart';
import 'services/firestore_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const AttendanceApp());
}

class AttendanceApp extends StatelessWidget {
  const AttendanceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        Provider(create: (_) => FirestoreService()),
      ],
      child: MaterialApp(
        title: 'Attendance App',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(primarySwatch: Colors.blue),
        home: const _AuthGate(),
        onGenerateRoute: (settings) {
          switch (settings.name) {
            case DashboardScreen.routeName:
              return _materialRoute(const DashboardScreen(), settings);
            case LoginScreen.routeName:
              return _materialRoute(const LoginScreen(), settings);
            case MarkAttendanceScreen.routeName:
              final args = _parseMarkAttendanceArgs(settings.arguments);
              if (args == null) {
                return _materialRoute(const _MissingArgumentsScreen(), settings);
              }
              return _materialRoute(
                MarkAttendanceScreen(
                  sessionId: args.sessionId,
                  organizationId: args.organizationId,
                ),
                settings,
              );
            default:
              return _materialRoute(const LoginScreen(), settings);
          }
        },
      ),
    );
  }

  MaterialPageRoute<dynamic> _materialRoute(Widget child, RouteSettings settings) {
    return MaterialPageRoute<dynamic>(builder: (_) => child, settings: settings);
  }

  MarkAttendanceArgs? _parseMarkAttendanceArgs(Object? arguments) {
    if (arguments is MarkAttendanceArgs) {
      return arguments;
    }
    if (arguments is Map<String, dynamic>) {
      final sessionId = arguments['sessionId'] as String?;
      final organizationId = arguments['organizationId'] as String?;
      if (sessionId == null || sessionId.isEmpty) {
        return null;
      }
      return MarkAttendanceArgs(
        sessionId: sessionId,
        organizationId: organizationId ?? '',
      );
    }
    return null;
  }
}

class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, _) {
        if (auth.isLoggedIn) {
          return const DashboardScreen();
        }
        return const LoginScreen();
      },
    );
  }
}

class _MissingArgumentsScreen extends StatelessWidget {
  const _MissingArgumentsScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Missing data')),
      body: const Center(
        child: Text('Session details were not provided.'),
      ),
    );
  }
}
