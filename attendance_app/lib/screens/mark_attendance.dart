import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../providers/auth_provider.dart';
import '../services/firestore_service.dart';

class MarkAttendanceArgs {
  const MarkAttendanceArgs({
    required this.sessionId,
    required this.organizationId,
  });

  final String sessionId;
  final String organizationId;
}

class MarkAttendanceScreen extends StatefulWidget {
  const MarkAttendanceScreen({
    super.key,
    required this.sessionId,
    required this.organizationId,
  });

  static const String routeName = '/mark-attendance';

  final String sessionId;
  final String organizationId;

  @override
  State<MarkAttendanceScreen> createState() => _MarkAttendanceScreenState();
}

class _MarkAttendanceScreenState extends State<MarkAttendanceScreen> {
  late Stream<List<AttendanceRecord>> _attendanceStream;
  final ImagePicker _picker = ImagePicker();
  XFile? _selectedImage;
  bool _saving = false;
  bool _initialised = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialised) return;
    _attendanceStream =
        context.read<FirestoreService>().attendanceBySession(widget.sessionId);
    _initialised = true;
  }

  Future<void> _pickImage() async {
    try {
      final image = await _picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1280,
        maxHeight: 1280,
        imageQuality: 85,
      );
      if (image == null) {
        return;
      }
      setState(() => _selectedImage = image);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unable to access camera: $e')),
      );
    }
  }

  Future<void> _markPresent() async {
    final auth = context.read<AuthProvider>();
    final service = context.read<FirestoreService>();
    final user = auth.user;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You must be signed in to mark attendance.')),
      );
      return;
    }

    try {
      setState(() => _saving = true);
      Uint8List? bytes;
      if (_selectedImage != null) {
        bytes = await _selectedImage!.readAsBytes();
      }

      String? imagePath;
      final String orgId = widget.organizationId.isEmpty
          ? (auth.role ?? 'default-org')
          : widget.organizationId;
      double? confidence;
      String? matchedUserId;

      if (bytes != null && bytes.isNotEmpty) {
        imagePath = await service.uploadFaceImage(
          organizationId: orgId,
          sessionId: widget.sessionId,
          bytes: bytes,
          userId: user.uid,
        );

        final api = Api();
        final verification = await api.verifyFace(bytes: bytes);
        confidence = verification.confidence;
        matchedUserId = verification.userId;
      }

      final record = AttendanceRecord(
        sessionId: widget.sessionId,
        userId: user.uid,
        status: 'present',
        confidence: confidence ?? 1.0,
        imagePath: imagePath,
        metadata: matchedUserId == null
            ? null
            : <String, dynamic>{'matchedUserId': matchedUserId},
      );

      await service.createOrUpdateAttendanceRecord(record);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Attendance marked successfully.')),
      );
      setState(() => _selectedImage = null);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to mark attendance: $e')),
      );
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d, h:mm a');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mark Attendance'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Session: ${widget.sessionId}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.photo_camera),
                    label: Text(
                      _selectedImage == null ? 'Add face photo' : 'Retake photo',
                    ),
                    onPressed: _saving ? null : _pickImage,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.check_circle),
                    label: _saving
                        ? const SizedBox(
                            height: 16,
                            width: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Mark Present'),
                    onPressed: _saving ? null : _markPresent,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Expanded(
              child: StreamBuilder<List<AttendanceRecord>>(
                stream: _attendanceStream,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting &&
                      !snapshot.hasData) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (snapshot.hasError) {
                    return Center(
                      child: Text('Failed to load attendance: ${snapshot.error}'),
                    );
                  }

                  final records = snapshot.data ?? const <AttendanceRecord>[];
                  if (records.isEmpty) {
                    return const Center(
                      child: Text('No attendance records yet. Be the first!'),
                    );
                  }

                  return ListView.separated(
                    itemCount: records.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final record = records[index];
                      final captured = record.capturedAt != null
                          ? dateFormat.format(record.capturedAt!)
                          : 'Pending sync';
                      final subtitle = <String>[
                        'User: ${record.userId}',
                        'Status: ${record.status}',
                        'Confidence: ${(record.confidence ?? 0).toStringAsFixed(2)}',
                        'Captured: $captured',
                      ].join('\n');

                      return ListTile(
                        leading: const Icon(Icons.person_outline),
                        title: Text(record.id ?? 'Attendance'),
                        subtitle: Text(subtitle),
                        trailing: record.imagePath == null
                            ? null
                            : const Icon(Icons.image, color: Colors.green),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
