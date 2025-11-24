import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { ApiTool } from '../../../src/tools/examples/apiTool';
import { ToolContext } from '../../../src/types';

describe('ApiTool', () => {
  let tool: ApiTool;
  let context: ToolContext;
  let originalFetch: typeof global.fetch;
  let fetchStub: sinon.SinonStub;

  beforeEach(() => {
    tool = new ApiTool();

    context = {
      extensionContext: {} as any,
      workspaceFolder: undefined,
      cancellationToken: {
        isCancellationRequested: false,
        onCancellationRequested: () => ({ dispose: () => {} }),
      } as any,
    };

    // Save original fetch and create stub
    originalFetch = global.fetch;
    fetchStub = sinon.stub();
    global.fetch = fetchStub as any;
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    sinon.restore();
  });

  // Helper to create mock response
  function createMockResponse(options: {
    status?: number;
    statusText?: string;
    contentType?: string;
    data?: any;
  }) {
    const { status = 200, statusText = 'OK', contentType = 'application/json', data = {} } = options;

    const headers = new Headers();
    headers.set('content-type', contentType);

    return {
      ok: status >= 200 && status < 300,
      status,
      statusText,
      headers,
      json: async () => data,
      text: async () => typeof data === 'string' ? data : JSON.stringify(data),
    };
  }

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(tool.id).to.equal('api_request');
    });

    it('should have correct name', () => {
      expect(tool.name).to.equal('API Request');
    });

    it('should have correct description', () => {
      expect(tool.description).to.include('HTTP');
    });

    it('should not require approval', () => {
      expect(tool.requiresApproval).to.be.false;
    });

    it('should be exposed to chat', () => {
      expect(tool.exposeToChat).to.be.true;
    });

    it('should have valid parameter schema', () => {
      expect(tool.parametersSchema).to.have.property('type', 'object');
      expect(tool.parametersSchema.required).to.include('url');
    });

    it('should have method enum in schema', () => {
      const methodProp = tool.parametersSchema.properties?.method as any;
      expect(methodProp.enum).to.include('GET');
      expect(methodProp.enum).to.include('POST');
      expect(methodProp.enum).to.include('PUT');
      expect(methodProp.enum).to.include('DELETE');
      expect(methodProp.enum).to.include('PATCH');
    });
  });

  describe('execute - GET request', () => {
    it('should make successful GET request', async () => {
      fetchStub.resolves(createMockResponse({
        status: 200,
        data: { message: 'success' },
      }));

      const result = await tool.execute(
        { url: 'https://api.example.com/data' },
        context
      );

      expect(result.success).to.be.true;
      expect(result.data.status).to.equal(200);
      expect(result.data.data).to.deep.equal({ message: 'success' });
    });

    it('should handle text response', async () => {
      fetchStub.resolves(createMockResponse({
        status: 200,
        contentType: 'text/plain',
        data: 'plain text response',
      }));

      const result = await tool.execute(
        { url: 'https://api.example.com/text' },
        context
      );

      expect(result.success).to.be.true;
      expect(result.data.data).to.equal('plain text response');
    });

    it('should use default GET method', async () => {
      fetchStub.resolves(createMockResponse({}));

      await tool.execute(
        { url: 'https://api.example.com/data' },
        context
      );

      expect(fetchStub.called).to.be.true;
      const callArgs = fetchStub.firstCall.args;
      expect(callArgs[1].method).to.equal('GET');
    });
  });

  describe('execute - POST request', () => {
    it('should make POST request with body', async () => {
      fetchStub.resolves(createMockResponse({
        status: 201,
        statusText: 'Created',
        data: { id: 1 },
      }));

      const result = await tool.execute(
        {
          url: 'https://api.example.com/create',
          method: 'POST',
          body: 'test body', // body should be a string
        },
        context
      );

      expect(result.success).to.be.true;
      expect(result.data.status).to.equal(201);
      expect(fetchStub.firstCall.args[1].method).to.equal('POST');
    });

    it('should include custom headers', async () => {
      fetchStub.resolves(createMockResponse({}));

      await tool.execute(
        {
          url: 'https://api.example.com/auth',
          headers: { 'Authorization': 'Bearer token123' },
        },
        context
      );

      const callArgs = fetchStub.firstCall.args;
      expect(callArgs[1].headers['Authorization']).to.equal('Bearer token123');
    });
  });

  describe('execute - error handling', () => {
    it('should handle network errors', async () => {
      fetchStub.rejects(new Error('Network error'));

      const result = await tool.execute(
        { url: 'https://api.example.com/data' },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('Request failed');
    });

    it('should handle abort errors as timeout', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      fetchStub.rejects(abortError);

      const result = await tool.execute(
        { url: 'https://api.example.com/slow', timeout: 100 },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('timed out');
    });

    it('should handle cancellation', async () => {
      const cancelledContext = {
        ...context,
        cancellationToken: {
          isCancellationRequested: true,
          onCancellationRequested: () => ({ dispose: () => {} }),
        } as any,
      };

      const result = await tool.execute(
        { url: 'https://api.example.com/data' },
        cancelledContext
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('cancelled');
    });

    it('should handle non-Error exceptions', async () => {
      // When rejecting with a non-Error, sinon converts it to an Error
      // Test that errors without messages are handled
      const customError = new Error('');
      fetchStub.rejects(customError);

      const result = await tool.execute(
        { url: 'https://api.example.com/data' },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('Request failed');
    });
  });

  describe('execute - validation', () => {
    it('should fail with missing URL', async () => {
      const result = await tool.execute(
        { method: 'GET' },
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('Invalid parameters');
    });

    it('should fail with empty parameters', async () => {
      const result = await tool.execute(
        {},
        context
      );

      expect(result.success).to.be.false;
      expect(result.error).to.include('Invalid parameters');
    });
  });

  describe('HTTP methods', () => {
    const methods = ['PUT', 'DELETE', 'PATCH'];

    methods.forEach(method => {
      it(`should support ${method} method`, async () => {
        fetchStub.resolves(createMockResponse({}));

        const result = await tool.execute(
          { url: 'https://api.example.com/resource', method },
          context
        );

        expect(result.success).to.be.true;
        expect(fetchStub.firstCall.args[1].method).to.equal(method);
      });
    });
  });

  describe('validateParameters', () => {
    it('should validate required URL parameter', () => {
      const validation = tool.validateParameters({});
      expect(validation.valid).to.be.false;
    });

    it('should accept valid parameters', () => {
      const validation = tool.validateParameters({
        url: 'https://example.com',
      });
      expect(validation.valid).to.be.true;
    });

    it('should accept parameters with all options', () => {
      const validation = tool.validateParameters({
        url: 'https://example.com',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"test": true}',
        timeout: 5000,
      });
      expect(validation.valid).to.be.true;
    });
  });
});
