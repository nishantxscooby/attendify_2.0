import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usernameController = TextEditingController(text: "S24CSEU2472"); // Pre-fill for testing
  final _passwordController = TextEditingController(text: "your_password"); // Pre-fill for testing
  bool _isLoading = false;

  void _handleLogin() async {
    setState(() => _isLoading = true);

    // Call the login method from the provider
    // 'listen: false' is important here because we are in a method, not the build function.
    bool success = await Provider.of<AuthProvider>(context, listen: false)
        .login(_usernameController.text, _passwordController.text);

    if (!success && mounted) {
      // If login fails, show an error
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Login Failed")),
      );
    }
    
    // No need for Navigator here, AuthGate will handle the screen change.
    
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Your UI with TextFields and a Button
    return Scaffold(
      appBar: AppBar(title: Text("Login")),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(controller: _usernameController, decoration: InputDecoration(labelText: 'Student ID')),
            SizedBox(height: 12),
            TextField(controller: _passwordController, decoration: InputDecoration(labelText: 'Password'), obscureText: true),
            SizedBox(height: 24),
            _isLoading
                ? CircularProgressIndicator()
                : ElevatedButton(onPressed: _handleLogin, child: Text('Login'))
          ],
        ),
      ),
    );
  }
}