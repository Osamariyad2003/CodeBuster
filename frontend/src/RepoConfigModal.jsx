import React from 'react';
import { Modal } from 'react-bootstrap';
import GitHubConnect from './GitHubConnect';

const RepoConfigModal = ({ show, onHide }) => {
    return (
        <Modal show={show} onHide={onHide} size="lg" centered scrollable>
            <Modal.Header closeButton style={{ border: 'none' }}>
                <Modal.Title className="fw-bold px-2">Manage Repositories</Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-0">
                <GitHubConnect isModal={true} onHide={onHide} />
            </Modal.Body>
        </Modal>
    );
};

export default RepoConfigModal;
