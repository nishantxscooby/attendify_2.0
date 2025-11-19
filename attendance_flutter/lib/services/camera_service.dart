import 'dart:convert';
import 'dart:io';
import 'package:camera/camera.dart';

class CameraService {
  CameraController? _controller;
  List<CameraDescription>? _cameras;
  CameraDescription? _camera;

  CameraController? get controller => _controller;

  Future<void> initialize() async {
    _cameras = await availableCameras();
    // Select the front camera
    _camera = _cameras!.firstWhere(
      (cam) => cam.lensDirection == CameraLensDirection.front,
      orElse: () => _cameras!.first,
    );
    
    _controller = CameraController(_camera!, ResolutionPreset.medium);
    await _controller!.initialize();
  }

  Future<XFile?> takePicture() async {
    if (!_controller!.value.isInitialized) {
      print("Error: camera not initialized.");
      return null;
    }
    if (_controller!.value.isTakingPicture) {
      return null;
    }
    try {
      final XFile file = await _controller!.takePicture();
      return file;
    } on CameraException catch (e) {
      print("Error taking picture: $e");
      return null;
    }
  }

  Future<String> convertXFileToBase64(XFile file) async {
    final bytes = await File(file.path).readAsBytes();
    return base64Encode(bytes);
  }

  void dispose() {
    _controller?.dispose();
  }
}