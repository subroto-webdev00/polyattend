'use client';
import React, { useState, useEffect } from 'react';
import api from '@/utils/api';
import Icon from '@/components/common/Icon';
import toast from 'react-hot-toast';
import Modal from '@/components/common/Modal';

export default function AdminDepartments() {
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/departments')
      .then(r => setDepts((r.data.departments || []).map(d => ({ ...d, _id: d.id || d._id }))))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  const openCreate = () => { setEditItem(null); setForm({ name: '', code: '', description: '' }); setShowModal(true); };
  const openEdit = d => { setEditItem(d); setForm({ name: d.name, code: d.code, description: d.description || '' }); setShowModal(true); };

  const handleSubmit = async () => {
    if (!form.name || !form.code) return toast.error('Enter Name and Code');
    setSaving(true);
    try {
      if (editItem) { await api.put(`/departments/${editItem._id}`, form); toast.success('Updated!'); }
      else { await api.post('/departments', form); toast.success('Department created!'); }
      setShowModal(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete?')) return;
    try { await api.delete(`/departments/${id}`); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="page-title">Departments</h2>
          <p className="page-sub">Add and manage departments</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', padding: '9px 18px' }} onClick={openCreate}>
          <Icon name="plus" size={16} /> New Dept
        </button>
      </div>

      <div className="card">
        {depts.length === 0 ? (
          <div className="empty"><div className="empty-icon"><Icon name="department" size={24} /></div><p>No departments yet</p></div>
        ) : depts.map(d => (
          <div key={d._id} className="list-item">
            <div className="item-icon icon-blue"><Icon name="department" size={18} /></div>
            <div className="item-content">
              <div className="item-title">{d.name}</div>
              <div className="item-sub">Code: {d.code}{d.description ? ` • ${d.description}` : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-icon" onClick={() => openEdit(d)}><Icon name="edit" size={16} /></button>
              <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(d._id)}><Icon name="trash" size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)}>
            <div className="modal-title">{editItem ? 'Edit Department' : 'New Department'}</div>
            <div className="form-group">
              <label className="form-label">Department Name *</label>
              <input className="form-input" placeholder="e.g. Computer Science & Technology" value={form.name} onChange={set('name')} />
            </div>
            <div className="form-group">
              <label className="form-label">Code *</label>
              <input className="form-input" placeholder="e.g. CST" value={form.code} onChange={set('code')} style={{ textTransform: 'uppercase' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="form-input" placeholder="Optional description" value={form.description} onChange={set('description')} />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? <><div className="spinner spinner-sm" /> Saving...</> : editItem ? 'Update' : 'Create'}
              </button>
            </div>
      </Modal>
    </div>
  );
}
