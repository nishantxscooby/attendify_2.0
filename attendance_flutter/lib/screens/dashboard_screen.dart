import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import 'session_screen.dart'; // Your camera screen

class DashboardScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // You can get the user's ID (token) from the provider if needed
    final authProvider = Provider.of<AuthProvider>(context);
    
    // For now, let's assume student_id is the username
    final studentId = "S24CSEU2472"; // Replace with actual logic to get student ID

    return Scaffold(
      appBar: AppBar(
        title: Text("Dashboard"),
        actions: [
          // Logout Button
          IconButton(
            icon: Icon(Icons.logout),
            onPressed: () {
              Provider.of<AuthProvider>(context, listen: false).logout();
            },
          )
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text("Welcome!", style: Theme.of(context).textTheme.headlineMedium),
            SizedBox(height: 40),
            ElevatedButton.icon(
              icon: Icon(Icons.camera_alt),
              label: Text("Mark Attendance"),
              style: ElevatedButton.styleFrom(padding: EdgeInsets.symmetric(horizontal: 30, vertical: 15)),
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => SessionScreen(studentId: studentId)),
                );
              },
            ),
            SizedBox(height: 20),
            // ... inside the build method of DashboardScreen ...

            TextButton(
              child: Text("View My Records"),
              onPressed: () {
                // NAVIGATE to the new screen
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => AttendanceRecordsScreen(studentId: studentId),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}