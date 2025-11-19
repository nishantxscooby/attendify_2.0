import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import '../services/camera_service.dart';
import '../services/api_service.dart';

class SessionScreen extends StatefulWidget {
  final String studentId; // Passed from the previous screen
  const SessionScreen({Key? key, required this.studentId}) : super(key: key);

  @override
  _SessionScreenState createState() => _SessionScreenState();
}

class _SessionScreenState extends State<SessionScreen> {
  final _cameraService = CameraService();
  final _apiService = ApiService();
  bool _isVerifying = false;

  @override
  void initState() {
    super.initState();
    _cameraService.initialize();
  }

  @override
  void dispose() {
    _cameraService.dispose();
    super.dispose();
  }

  void _onCapture() async {
    setState(() => _isVerifying = true);

    final picture = await _cameraService.takePicture();
    if (picture != null) {
      final base64Image = await _cameraService.convertXFileToBase64(picture);
      final isVerified = await _apiService.verifyFace(widget.studentId, base64Image);

      // Show result to the user
      final message = isVerified ? "Attendance Marked!" : "Verification Failed.";
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      if (isVerified) {
        Navigator.of(context).pop(); // Go back on success
      }
    }
    
    setState(() => _isVerifying = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder(
        future: _cameraService.initialize(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.done) {
            return Stack(
              fit: StackFit.expand,
              children: [
                CameraPreview(_cameraService.controller!),
                // Overlay with a capture button
                Align(
                  alignment: Alignment.bottomCenter,
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: FloatingActionButton(
                      onPressed: _isVerifying ? null : _onCapture,
                      child: _isVerifying 
                          ? CircularProgressIndicator(color: Colors.white) 
                          : Icon(Icons.camera_alt),
                    ),
                  ),
                ),
              ],
            );
          } else {
            return Center(child: CircularProgressIndicator());
          }
        },
      ),
    );
  }
}