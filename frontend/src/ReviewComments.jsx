import React from 'react';
import { Card, Accordion, Table } from 'react-bootstrap';

const ReviewComments = ({ review }) => {
  if (!review || Object.keys(review).length === 0) {
    return (
      <Card>
        <Card.Body>
          <Card.Title>Review Comments</Card.Title>
          <p>No review comments to display. Drop a project folder above to get started.</p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Body>
        <Card.Title>Review Comments</Card.Title>
        <Accordion defaultActiveKey="0">
          {Object.entries(review).map(([filePath, comments], index) => (
            <Accordion.Item eventKey={String(index)} key={filePath}>
              <Accordion.Header>{filePath}</Accordion.Header>
              <Accordion.Body>
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th>Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comments.map((comment, i) => (
                      <tr key={i}>
                        <td>{comment.line}</td>
                        <td>{comment.comment}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      </Card.Body>
    </Card>
  );
};

export default ReviewComments;
