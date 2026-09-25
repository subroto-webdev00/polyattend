'use client';

import React, { useEffect, useState } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import { formatDepartment, formatShift } from '@/lib/display';

export default function StudentSubjects() {
const [subjects, setSubjects] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
const fetchSubjects = async () => {
try {
const response = await api.get('/subjects');
setSubjects(response.data?.subjects || []);
} catch (error) {
console.error('Failed to load subjects:', error);
setSubjects([]);
} finally {
setLoading(false);
}
};


fetchSubjects();


}, []);

if (loading) {
return ( <div className="loading"> <div className="spinner" /> </div>
);
}

return ( <div className="page">

```
  {/* Page Header */}
  <div className="page-header">
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="book" size={20} />
        </div>

        <div>
          <h2 className="page-title">My Teachers</h2>
          <p className="page-sub">
            Find your subject-wise teacher contact information
          </p>
        </div>
      </div>
    </div>

    <div
      style={{
        padding: '7px 12px',
        borderRadius: 20,
        background: 'var(--primary-light)',
        color: 'var(--primary)',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {subjects.length} Subjects
    </div>
  </div>

  {/* Empty State */}
  {subjects.length === 0 ? (
    <div className="card">
      <div className="empty">
        <div className="empty-icon">
          <Icon name="book" size={26} />
        </div>

        <h3
          style={{
            marginTop: 12,
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          No Subjects Found
        </h3>

        <p
          style={{
            marginTop: 5,
            fontSize: 12,
            color: 'var(--txt3)',
          }}
        >
          No subjects have been assigned to your class yet.
        </p>
      </div>
    </div>
  ) : (

    /* Subject Grid */
    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}
    >
      {subjects.map((subject) => (
        <div
          key={subject._id}
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            transition: 'all 0.2s ease',
          }}
        >

          {/* Subject Information */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                flexShrink: 0,
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="book" size={20} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  lineHeight: 1.4,
                }}
              >
                {subject.name}
              </div>

              <div
                style={{
                  marginTop: 3,
                  fontSize: 11.5,
                  color: 'var(--txt3)',
                }}
              >
                Subject Code: {subject.code || 'N/A'}
               </div>
               <div style={{ marginTop: 6, fontSize: 11, color: 'var(--txt2)' }}>
                 {formatDepartment(subject.departmentId, subject.departmentCode)} • Sem {subject.semester} • Group {subject.section} • {formatShift(subject.shift)} Shift
               </div>
              </div>
            </div>

          {/* Teacher Section */}
          <div
            style={{
              borderTop: '1px dashed var(--border)',
              paddingTop: 14,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: 'var(--txt3)',
                textTransform: 'uppercase',
                letterSpacing: 0.7,
                marginBottom: 10,
              }}
            >
              Assigned Teacher
            </div>

            {subject.teacherId ? (
              <>
                {/* Teacher Profile */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: 'var(--accent-light)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {subject.teacherId.name
                      ?.charAt(0)
                      ?.toUpperCase()}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                      }}
                    >
                      {subject.teacherId.name}
                    </div>

                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 11.5,
                        color: 'var(--txt3)',
                      }}
                    >
                      Subject Teacher
                    </div>
                  </div>
                </div>

                {/* Contact Button */}
                {subject.teacherId.mobile ? (
                  <a
                    href={`tel:${subject.teacherId.mobile}`}
                    style={{
                      marginTop: 14,
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      padding: '9px 12px',
                      borderRadius: 9,
                      fontSize: 12.5,
                      fontWeight: 700,
                      textDecoration: 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Icon name="phone" size={15} />
                    {subject.teacherId.mobile}
                  </a>
                ) : (
                  <div
                    style={{
                      marginTop: 12,
                      padding: '9px 10px',
                      borderRadius: 8,
                      background: 'var(--bg2)',
                      fontSize: 11.5,
                      color: 'var(--txt3)',
                      textAlign: 'center',
                    }}
                  >
                    Contact number is not available
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  padding: '12px',
                  borderRadius: 9,
                  background: 'var(--bg2)',
                  fontSize: 12,
                  color: 'var(--txt3)',
                  textAlign: 'center',
                }}
              >
                No teacher has been assigned yet
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )}
</div>

);
}
