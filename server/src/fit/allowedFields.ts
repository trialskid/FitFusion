export const ALLOWED_MESSAGE_FIELDS: Record<string, readonly string[]> = {
  record: [
    'timestamp',
    'position_lat',
    'position_long',
    'gps_accuracy',
    'altitude',
    'distance',
    'heart_rate',
    'enhanced_speed',
    'speed',
    'cadence',
    'power',
    'temperature',
    'vertical_speed'
  ],
  event: ['timestamp', 'event', 'event_type', 'event_group', 'data', 'data16', 'data32', 'timer_trigger'],
  lap: [
    'timestamp',
    'event',
    'event_type',
    'start_time',
    'lap_trigger',
    'total_elapsed_time',
    'total_timer_time',
    'total_moving_time',
    'total_distance',
    'total_calories',
    'avg_speed',
    'max_speed',
    'avg_heart_rate',
    'max_heart_rate',
    'min_heart_rate',
    'avg_power',
    'max_power',
    'sport',
    'sub_sport',
    'message_index'
  ],
  session: [
    'timestamp',
    'start_time',
    'total_distance',
    'total_timer_time',
    'total_elapsed_time',
    'total_moving_time',
    'total_calories',
    'total_work',
    'avg_speed',
    'max_speed',
    'avg_heart_rate',
    'max_heart_rate',
    'min_heart_rate',
    'avg_power',
    'max_power',
    'normalized_power',
    'avg_altitude',
    'max_altitude',
    'min_altitude',
    'total_ascent',
    'total_descent',
    'avg_temperature',
    'first_lap_index',
    'num_laps',
    'sport',
    'sub_sport',
    'event',
    'event_type',
    'trigger',
    'nec_lat',
    'nec_long',
    'swc_lat',
    'swc_long',
    'message_index'
  ],
  activity: [
    'timestamp',
    'local_timestamp',
    'num_sessions',
    'type',
    'event',
    'event_type',
    'total_timer_time',
    'total_distance',
    'total_calories',
    'total_ascent',
    'total_descent'
  ],
  file_id: [
    'type',
    'manufacturer',
    'product',
    'serial_number',
    'time_created',
    'garmin_product',
    'product_name'
  ]
};

export const RECORD_FIELD_WHITELIST = new Set(ALLOWED_MESSAGE_FIELDS.record);

const LAT_LNG_FIELDS = new Set([
  'position_lat',
  'position_long',
  'start_position_lat',
  'start_position_long',
  'end_position_lat',
  'end_position_long',
  'nec_lat',
  'nec_long',
  'swc_lat',
  'swc_long'
]);

export function isLatLongFieldName(key: string): boolean {
  return LAT_LNG_FIELDS.has(key);
}
