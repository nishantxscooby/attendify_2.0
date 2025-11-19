import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart'; // You will create this next

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // Provide the AuthProvider to the entire widget tree
    return ChangeNotifierProvider(
      create: (ctx) => AuthProvider(),
      child: MaterialApp(
        title: 'Attendance App',
        theme: ThemeData(primarySwatch: Colors.blue),
        home: AuthGate(),
      ),
    );
  }
}

class AuthGate extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // Consumer widget rebuilds whenever AuthProvider changes
    return Consumer<AuthProvider>(
      builder: (context, authProvider, child) {
        switch (authProvider.status) {
          case AuthStatus.Uninitialized:
            // Show a loading screen while checking for token
            return Scaffold(body: Center(child: CircularProgressIndicator()));
          case AuthStatus.Unauthenticated:
            // Show login screen
            return LoginScreen();
          case AuthStatus.Authenticated:
            // Show the main app dashboard
            return DashboardScreen();
        }
      },
    );
  }
}