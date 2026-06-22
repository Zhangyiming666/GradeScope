export const CSV_COLUMNS = [
  'schema_version',
  'term_id',
  'term_name',
  'academic_year',
  'season',
  'course_id',
  'course_code',
  'course_name',
  'credits',
  'include_in_gpa',
  'course_status',
  'target_university_score',
  'official_raw_score',
  'official_university_score',
  'official_gpa',
  'grading_profile_id',
  'component_id',
  'component_name',
  'component_weight_percent',
  'component_earned_points',
  'component_max_points',
  'component_score_status',
  'component_order',
  'created_at',
  'updated_at'
] as const

export type CsvColumn = (typeof CSV_COLUMNS)[number]
export type CsvRow = Record<CsvColumn, string>

export interface CsvImportError {
  rowNumber: number
  message: string
}

export interface CsvPreview {
  terms: number
  courses: number
  components: number
  errors: CsvImportError[]
  conflicts: number
}

export type CsvImportMode = 'merge' | 'overwrite'
