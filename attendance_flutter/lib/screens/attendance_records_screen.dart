import 'package:flutter/material.dart';
import '../models/attendance_record.dart';
import '../services/api_service.dart';

class AttendanceRecordsScreen extends StatefulWidget {
  final String studentId;

  const AttendanceRecordsScreen({Key? key, required this.studentId}) : super(key: key);

  @override
  State<AttendanceRecordsScreen> createState() => _AttendanceRecordsScreenState();
}

class _AttendanceRecordsScreenState extends State<AttendanceRecordsScreen> {
  final ApiService _apiService = ApiService();
  late Future<Map<String, dynamic>?> _attendanceFuture;

  @override
  void initState() {
    super.initState();
    // Fetch the data when the screen is first built
    _attendanceFuture = _apiService.getAttendance(widget.studentId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Attendance History"),
      ),
      body: FutureBuilder<Map<String, dynamic>?>(
        future: _attendanceFuture,
        builder: (context, snapshot) {
          // 1. WHILE LOADING
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator());
          }

          // 2. IF THERE'S AN ERROR or NO DATA
          if (snapshot.hasError || !snapshot.hasData || snapshot.data == null) {
            return Center(child: Text("Could not load records. Please try again."));
          }

          // 3. IF DATA IS LOADED SUCCESSFULLY
          final data = snapshot.data!;
          final percentage = data['attendance_percentage'] ?? 0.0;
          final records = (data['records'] as List)
              .map((item) => AttendanceRecord.fromJson(item))
              .toList();

          if (records.isEmpty) {
            return Center(child: Text("No attendance records found."));
          }
          
          return Column(
            children: [
              // Header with attendance percentage
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: Card(
                  elevation: 4,
                  child: ListTile(
                    title: Text("Overall Percentage", style: TextStyle(fontWeight: FontWeight.bold)),
                    trailing: Text(
                      "${percentage.toStringAsFixed(1)}%",
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.blue),
                    ),
                  ),
                ),
              ),
              // List of records
              Expanded(
                child: ListView.builder(
                  itemCount: records.length,
                  itemBuilder: (context, index) {
                    final record = records[index];
                    final isPresent = record.status.toLowerCase() == 'present';
                    return Card(
                      margin: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      child: ListTile(
                        leading: Icon(
                          isPresent ? Icons.check_circle : Icons.cancel,
                          color: isPresent ? Colors.green : Colors.red,
                        ),
                        title: Text("Date: ${record.date}"),
                        trailing: Text(
                          record.status,
                          style: TextStyle(
                            color: isPresent ? Colors.green : Colors.red,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}